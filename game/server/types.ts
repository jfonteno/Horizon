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

export type StoredRoom = {
  schemaVersion: number;
  code: string;
  mode: RoomMode;
  status: RoomStatus;
  revision: number;
  game: GameState;
  hostTokenHash: string;
  seats: RoomSeat[];
  events: RoomEvent[];
  commandReceipts: RoomCommandReceipt[];
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
  seats: Array<{
    playerId: number;
    civilization: string;
    faction: string;
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
