import { mkdir, open, readFile, rename, stat, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { normalizeStoredRoom } from "./rooms";
import type { RoomRepository, StoredRoom } from "./types";

const ROOM_FILE = /^[A-Z2-9]{6}$/;

function roomCode(raw: string) {
  const code = raw.trim().toUpperCase();
  if (!ROOM_FILE.test(code)) throw new Error("Invalid room code for disk storage.");
  return code;
}

/**
 * Durable single-process room storage for a physical Horizon server.
 *
 * Each write is flushed to a temporary file and atomically renamed. A
 * per-room promise queue makes compare-and-swap exact within the one supported
 * Node process. Use D1 or a future PostgreSQL adapter for multiple replicas.
 */
export class DiskRoomRepository implements RoomRepository {
  readonly kind = "disk" as const;
  private queues = new Map<string, Promise<unknown>>();
  readonly directory: string;

  constructor(directory: string) {
    this.directory = resolve(directory);
  }

  async initialize() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
  }

  private path(code: string) {
    return join(this.directory, `${roomCode(code)}.json`);
  }

  private async exclusive<T>(code: string, task: () => Promise<T>): Promise<T> {
    const key = roomCode(code);
    const previous = this.queues.get(key) || Promise.resolve();
    const current = previous.then(task, task);
    const queued = current.catch(() => undefined);
    this.queues.set(key, queued);
    try {
      return await current;
    } finally {
      if (this.queues.get(key) === queued) this.queues.delete(key);
    }
  }

  private async readUnlocked(code: string): Promise<StoredRoom | null> {
    try {
      const payload = await readFile(this.path(code), "utf8");
      return normalizeStoredRoom(JSON.parse(payload) as StoredRoom);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      if (error instanceof SyntaxError)
        throw new Error(`Stored room ${roomCode(code)} is corrupt and must be restored from backup.`);
      throw error;
    }
  }

  private async writeUnlocked(room: StoredRoom) {
    await this.initialize();
    const target = this.path(room.code);
    const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(normalizeStoredRoom(structuredClone(room)))}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  async get(code: string) {
    await this.initialize();
    return this.readUnlocked(code);
  }

  async put(room: StoredRoom) {
    return this.exclusive(room.code, () => this.writeUnlocked(room));
  }

  async compareAndSwap(room: StoredRoom, expectedRevision: number) {
    return this.exclusive(room.code, async () => {
      const current = await this.readUnlocked(room.code);
      if (!current || current.revision !== expectedRevision) return false;
      await this.writeUnlocked(room);
      return true;
    });
  }

  async health() {
    try {
      await this.initialize();
      const information = await stat(this.directory);
      return information.isDirectory()
        ? { ok: true }
        : { ok: false, detail: "Room storage path is not a directory." };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : "Disk storage health check failed." };
    }
  }
}
