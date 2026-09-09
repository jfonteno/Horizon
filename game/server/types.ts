import type { GameState, PlayerController } from "../types";

export type RoomRole = "host" | "player" | "spectator";
export type RoomStatus = "lobby" | "active" | "paused" | "complete";

export type RoomMode = "local" | "network";

export type RoomSeat = {
  playerId: number;
  controller: PlayerController;
  displayName: string | null;
  tokenHash: string | null;
  joinedAt: string | null;
  ready: boolean;
  selectedFaction: string | null;
};

export type RoomEvent = {
  id: string;
  at: string;
  revision: number;
  type: "system" | "seat" | "phase" | "orders" | "diplomacy" | "combat";
  message: string;
  playerId?: number;
};

export type RoomCommandReceipt = {
  commandId: string;
  playerId: number;
  revision: number;
  message: string;
};

export type RoomAuditEntry = {
  sequence: number;
  commandId: string;
  playerId: number;
  commandKind: string;
  commandLabel: string;
  command: unknown;
  acceptedAt: string;
  revision: number;
  previousHash: string;
  stateHash: string;
  entryHash: string;
};

export type StoredRoom = {
  schemaVersion: number;
  code: string;
  mode: RoomMode;
  status: RoomStatus;
  revision: number;
  game: GameState;
  initialGame?: GameState;
  availableFactions: string[];
  hostTokenHash: string;
  seats: RoomSeat[];
  events: RoomEvent[];
  commandReceipts: RoomCommandReceipt[];
  auditStartRevision?: number;
  initialStateHash?: string;
  audit: RoomAuditEntry[];
  turnTimerSeconds: number | null;
  turnDeadlineAt: string | null;
  turnTimerPausedRemainingMs: number | null;
  createdAt: string;
  updatedAt: string;
};

export type RoomSummary = {
  code: string;
  mode: RoomMode;
  status: RoomStatus;
  revision: number;
  turn: number;
  era: number;
  activePlayerId: number;
  turnTimerSeconds: number | null;
  turnDeadlineAt: string | null;
  availableFactions: Array<{
    id: string;
    name: string;
    role: string;
    color: string;
    logo?: string;
    blurb?: string;
    lore?: string[];
    abilities?: Array<{ name: string; summary: string; unlock?: string }>;
    objectives?: string[];
    homeProduction?: string;
  }>;
  seats: Array<{
    playerId: number;
    civilization: string;
    faction: string | null;
    controller: PlayerController;
    displayName: string | null;
    claimed: boolean;
    ready: boolean;
    ordersSubmitted: boolean;
  }>;
  recentEvents: RoomEvent[];
  updatedAt: string;
};

export type RoomSession = {
  code: string;
  token: string;
  role: RoomRole;
  playerId?: number;
  revision: number;
  summary: RoomSummary;
  game: GameState;
};

export type RoomIdentity = Pick<
  RoomSession,
  "code" | "token" | "role" | "playerId" | "revision"
>;

export type AuthenticatedRoomSeat = {
  room: StoredRoom;
  role: "host" | "player";
  playerId: number;
};

export interface RoomRepository {
  readonly kind: "memory" | "d1" | "disk";
  get(code: string): Promise<StoredRoom | null>;
  put(room: StoredRoom): Promise<void>;
  compareAndSwap(room: StoredRoom, expectedRevision: number): Promise<boolean>;
  health?(): Promise<{ ok: boolean; detail?: string }>;
}
