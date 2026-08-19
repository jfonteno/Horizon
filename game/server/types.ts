import type { GameState } from "../types";

export type RoomRole = "host" | "player";
export type RoomStatus = "active" | "complete";

export type RoomSeat = {
  playerId: number;
  displayName: string | null;
  tokenHash: string | null;
  joinedAt: string | null;
};

export type StoredRoom = {
  code: string;
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
  status: RoomStatus;
  revision: number;
  turn: number;
  era: number;
  activePlayerId: number;
  seats: Array<{
    playerId: number;
    civilization: string;
    faction: string;
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

export interface RoomRepository {
  get(code: string): Promise<StoredRoom | null>;
  put(room: StoredRoom): Promise<void>;
}
