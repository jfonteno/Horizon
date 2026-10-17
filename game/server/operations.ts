import { mkdir, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { replaceRoomFile } from "./atomic-room-save";

export type MultiplayerVerificationMode = "commander" | "room-code";

export type OperationsAuditEntry = {
  id: string;
  actorAccountId: string;
  action: string;
  reason: string;
  at: string;
};

export type PlaytestAccessSettings = {
  schemaVersion: 1;
  multiplayerVerification: MultiplayerVerificationMode;
  roomCreationOpen: boolean;
  spectatorsAllowed: boolean;
  notice: string | null;
  updatedAt: string;
  updatedBy: string;
  audit: OperationsAuditEntry[];
};

export interface OperationsSettingsRepository {
  readonly kind: "memory" | "disk" | "d1";
  get(): Promise<PlaytestAccessSettings>;
  put(settings: PlaytestAccessSettings): Promise<void>;
  health?(): Promise<{ ok: boolean; detail?: string }>;
}

export function defaultPlaytestAccessSettings(): PlaytestAccessSettings {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    multiplayerVerification: process.env.HORIZON_MULTIPLAYER_VERIFICATION === "room-code" ? "room-code" : "commander",
    roomCreationOpen: true,
    spectatorsAllowed: true,
    notice: null,
    updatedAt: now,
    updatedBy: "system",
    audit: [],
  };
}

function normalize(value?: Partial<PlaytestAccessSettings> | null): PlaytestAccessSettings {
  const fallback = defaultPlaytestAccessSettings();
  return {
    ...fallback,
    ...value,
    schemaVersion: 1,
    multiplayerVerification: value?.multiplayerVerification === "room-code" ? "room-code" : "commander",
    roomCreationOpen: value?.roomCreationOpen !== false,
    spectatorsAllowed: value?.spectatorsAllowed !== false,
    notice: typeof value?.notice === "string" && value.notice.trim() ? value.notice.trim().slice(0, 500) : null,
    audit: Array.isArray(value?.audit) ? value.audit.slice(-200) : [],
  };
}

export function updatePlaytestAccessSettings(
  current: PlaytestAccessSettings,
  patch: Partial<Pick<PlaytestAccessSettings, "multiplayerVerification" | "roomCreationOpen" | "spectatorsAllowed" | "notice">>,
  actorAccountId: string,
  reason: string,
) {
  if (!reason.trim()) throw new Error("An operational reason is required.");
  const now = new Date().toISOString();
  const next = normalize({ ...current, ...patch, updatedAt: now, updatedBy: actorAccountId });
  next.audit = [...current.audit, {
    id: crypto.randomUUID(), actorAccountId, action: "update-playtest-access", reason: reason.trim().slice(0, 500), at: now,
  }].slice(-200);
  return next;
}

export class MemoryOperationsSettingsRepository implements OperationsSettingsRepository {
  readonly kind = "memory" as const;
  private settings: PlaytestAccessSettings;
  constructor(initial?: PlaytestAccessSettings) { this.settings = normalize(initial); }
  async get() { return structuredClone(this.settings); }
  async put(settings: PlaytestAccessSettings) { this.settings = normalize(structuredClone(settings)); }
}

export class DiskOperationsSettingsRepository implements OperationsSettingsRepository {
  readonly kind = "disk" as const;
  readonly path: string;
  constructor(path: string) { this.path = resolve(path); }
  async initialize() { await mkdir(dirname(this.path), { recursive: true, mode: 0o700 }); }
  async get() {
    await this.initialize();
    try { return normalize(JSON.parse(await readFile(this.path, "utf8")) as PlaytestAccessSettings); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const settings = defaultPlaytestAccessSettings(); await this.put(settings); return settings;
      }
      if (error instanceof SyntaxError) throw new Error("Operations settings are corrupt and must be restored from backup.");
      throw error;
    }
  }
  async put(settings: PlaytestAccessSettings) {
    await this.initialize();
    const target = this.path, temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(`${JSON.stringify(normalize(settings))}\n`, "utf8"); await handle.sync(); }
    finally { await handle.close(); }
    try { await replaceRoomFile(temporary, target); }
    catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
  }
  async health() {
    try { await this.initialize(); const info = await stat(dirname(this.path)); return { ok: info.isDirectory() }; }
    catch (error) { return { ok: false, detail: error instanceof Error ? error.message : "Operations storage unavailable." }; }
  }
}

export class D1OperationsSettingsRepository implements OperationsSettingsRepository {
  readonly kind = "d1" as const;
  private initialized = false;
  constructor(private database: D1Database) {}
  private async initialize() {
    if (this.initialized) return;
    await this.database.prepare("CREATE TABLE IF NOT EXISTS horizon_operations (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
    this.initialized = true;
  }
  async get() {
    await this.initialize();
    const row = await this.database.prepare("SELECT payload FROM horizon_operations WHERE id = 'settings'").first<{ payload: string }>();
    if (row) return normalize(JSON.parse(row.payload) as PlaytestAccessSettings);
    const settings = defaultPlaytestAccessSettings(); await this.put(settings); return settings;
  }
  async put(settings: PlaytestAccessSettings) {
    await this.initialize();
    const normalized = normalize(settings);
    await this.database.prepare("INSERT INTO horizon_operations (id, payload, updated_at) VALUES ('settings', ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at").bind(JSON.stringify(normalized), normalized.updatedAt).run();
  }
  async health() { try { await this.initialize(); await this.database.prepare("SELECT 1 AS ok").first(); return { ok: true }; } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : "Operations storage unavailable." }; } }
}
