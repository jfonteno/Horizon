import { D1RoomRepository } from "./d1-room-repository";
import { MemoryRoomRepository, RoomService } from "./rooms";
import type { RoomRepository } from "./types";
import { AccountService, D1AccountRepository, MemoryAccountRepository, type AccountRepository } from "./accounts";
import { D1OperationsSettingsRepository, MemoryOperationsSettingsRepository, type OperationsSettingsRepository } from "./operations";

const runtime = globalThis as typeof globalThis & {
  __horizonRoomDatabase?: D1Database;
  __horizonRoomRepository?: RoomRepository;
  __horizonAccountRepository?: AccountRepository;
  __horizonOperationsRepository?: OperationsSettingsRepository;
};

export function setRoomDatabase(database?: D1Database) {
  if (database && runtime.__horizonRoomDatabase !== database) {
    runtime.__horizonRoomDatabase = database;
    runtime.__horizonRoomRepository = new D1RoomRepository(database);
    runtime.__horizonAccountRepository = new D1AccountRepository(database);
    runtime.__horizonOperationsRepository = new D1OperationsSettingsRepository(database);
  }
}

/** Inject a platform-specific repository before the production server starts. */
export function setRoomRepository(repository: RoomRepository) {
  runtime.__horizonRoomDatabase = undefined;
  runtime.__horizonRoomRepository = repository;
}

export function setAccountRepository(repository: AccountRepository) {
  runtime.__horizonAccountRepository = repository;
}

export function setOperationsSettingsRepository(repository: OperationsSettingsRepository) {
  runtime.__horizonOperationsRepository = repository;
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

export function getAccountRepository(): AccountRepository {
  runtime.__horizonAccountRepository ||= runtime.__horizonRoomDatabase
    ? new D1AccountRepository(runtime.__horizonRoomDatabase)
    : new MemoryAccountRepository();
  return runtime.__horizonAccountRepository;
}

export function getAccountService() { return new AccountService(getAccountRepository()); }

export function getOperationsSettingsRepository(): OperationsSettingsRepository {
  runtime.__horizonOperationsRepository ||= runtime.__horizonRoomDatabase
    ? new D1OperationsSettingsRepository(runtime.__horizonRoomDatabase)
    : new MemoryOperationsSettingsRepository();
  return runtime.__horizonOperationsRepository;
}

/**
 * Test/dev helper. Do not call from normal request handlers.
 */
export function resetRoomRuntimeForTests() {
  runtime.__horizonRoomRepository = undefined;
  runtime.__horizonRoomDatabase = undefined;
  runtime.__horizonAccountRepository = undefined;
  runtime.__horizonOperationsRepository = undefined;
}
