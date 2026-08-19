import type { RoomRepository, StoredRoom } from "./types";

export class D1RoomRepository implements RoomRepository {
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
    return row ? (JSON.parse(row.payload) as StoredRoom) : null;
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
}
