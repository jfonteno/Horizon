import { D1RoomRepository } from "./d1-room-repository";
import { MemoryRoomRepository, RoomService } from "./rooms";
import type { RoomRepository } from "./types";

const runtime = globalThis as typeof globalThis & {
  __horizonRoomDatabase?: D1Database;
  __horizonRoomRepository?: RoomRepository;
};

export function setRoomDatabase(database?: D1Database) {
  if (database && runtime.__horizonRoomDatabase !== database) {
    runtime.__horizonRoomDatabase = database;
    runtime.__horizonRoomRepository = new D1RoomRepository(database);
  }
}

export function getRoomService() {
  runtime.__horizonRoomRepository ||= runtime.__horizonRoomDatabase
    ? new D1RoomRepository(runtime.__horizonRoomDatabase)
    : new MemoryRoomRepository();
  return new RoomService(runtime.__horizonRoomRepository);
}
