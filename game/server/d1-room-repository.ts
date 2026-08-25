import type { RoomRepository, StoredRoom } from "./types";
import { normalizeStoredRoom } from "./rooms";

export class D1RoomRepository implements RoomRepository {
  readonly kind = "d1" as const;
  private initialized = false;

  constructor(private database: D1Database) {}

  private async initialize() {
    if (this.initialized) return;
    await this.database
      .prepare(
        "CREATE TABLE IF NOT EXISTS horizon_rooms (code TEXT PRIMARY KEY, payload TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL)",
      )
      .run();
    this.initialized = true;
  }

  async get(code: string) {
    await this.initialize();
    const row = await this.database
      .prepare("SELECT payload FROM horizon_rooms WHERE code = ?")
      .bind(code)
      .first<{ payload: string }>();
    return row ? normalizeStoredRoom(JSON.parse(row.payload) as StoredRoom) : null;
  }

  async put(room: StoredRoom) {
    await this.initialize();
    await this.database
      .prepare(
        "INSERT INTO horizon_rooms (code, payload, revision, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(code) DO UPDATE SET payload = excluded.payload, revision = excluded.revision, updated_at = excluded.updated_at",
      )
      .bind(room.code, JSON.stringify(room), room.revision, room.updatedAt)
      .run();
  }

  async compareAndSwap(room: StoredRoom, expectedRevision: number) {
    await this.initialize();
    const result = await this.database
      .prepare(
        "UPDATE horizon_rooms SET payload = ?, revision = ?, updated_at = ? WHERE code = ? AND revision = ?",
      )
      .bind(JSON.stringify(room), room.revision, room.updatedAt, room.code, expectedRevision)
      .run();
    return (result.meta.changes || 0) > 0;
  }

  async health() {
    try {
      await this.initialize();
      await this.database.prepare("SELECT 1 AS ok").first();
      return { ok: true };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : "D1 health check failed." };
    }
  }
}
