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

/**
 * All room API routes and command handlers should obtain the repository through
 * this function so they share the same persistence backend.
 */
export function getRoomRepository(): RoomRepository {
  runtime.__horizonRoomRepository ||= runtime.__horizonRoomDatabase
    ? new D1RoomRepository(runtime.__horizonRoomDatabase)
    : new MemoryRoomRepository();

  return runtime.__horizonRoomRepository;
}

export function getRoomService() {
  return new RoomService(getRoomRepository());
}

/**
 * Test/dev helper. Do not call from normal request handlers.
 */
export function resetRoomRuntimeForTests() {
  runtime.__horizonRoomRepository = undefined;
  runtime.__horizonRoomDatabase = undefined;
}
