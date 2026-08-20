import type { GameState, PlayerController } from "../types";

export type RoomRole = "host" | "player";
export type RoomStatus = "active" | "complete";

export type RoomMode = "local" | "network";

export type RoomSeat = {
  playerId: number;
  controller: PlayerController;
  displayName: string | null;
  tokenHash: string | null;
  joinedAt: string | null;
};

export type StoredRoom = {
  code: string;
  mode: RoomMode;
  status: RoomStatus;
  revision: number;
  game: GameState;
  hostTokenHash: string;
  seats: RoomSeat[];
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
  }>;
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
  role: RoomRole;
  playerId: number;
};

export interface RoomRepository {
  get(code: string): Promise<StoredRoom | null>;
  put(room: StoredRoom): Promise<void>;
}
