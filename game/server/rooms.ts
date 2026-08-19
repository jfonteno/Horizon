import type { GameState } from "../types";
import { projectPrivateGame } from "./private-view";
import type {
  RoomRepository,
  RoomSession,
  RoomSummary,
  StoredRoom,
} from "./types";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomText(length: number, alphabet = ROOM_ALPHABET) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function validateGame(game: GameState) {
  if (game.players.length < 4 || game.players.length > 6)
    throw new Error("Network rooms support four to six civilizations.");
  if (game.players.some((player, index) => player.id !== index))
    throw new Error("Player seats must use consecutive identifiers.");
  if (game.active < 0 || game.active >= game.players.length)
    throw new Error("The active civilization is invalid.");
  if (game.turn < 1 || game.turn > 16 || game.era < 1 || game.era > 4)
    throw new Error("The Turn or Era is outside the playtest range.");
}

function summary(room: StoredRoom): RoomSummary {
  return {
    code: room.code,
    status: room.status,
    revision: room.revision,
    turn: room.game.turn,
    era: room.game.era,
    activePlayerId: room.game.active,
    seats: room.seats.map((seat) => ({
      playerId: seat.playerId,
      civilization: room.game.players[seat.playerId].name,
      faction: room.game.players[seat.playerId].faction,
      displayName: seat.displayName,
      claimed: Boolean(seat.tokenHash),
    })),
    updatedAt: room.updatedAt,
  };
}

export class MemoryRoomRepository implements RoomRepository {
  private rooms = new Map<string, StoredRoom>();

  async get(code: string) {
    const room = this.rooms.get(code);
    return room ? structuredClone(room) : null;
  }

  async put(room: StoredRoom) {
    this.rooms.set(room.code, structuredClone(room));
  }
}

export class RoomService {
  constructor(private repository: RoomRepository) {}

  async create(game: GameState, displayName: string): Promise<RoomSession> {
    validateGame(game);
    let code = randomText(6);
    while (await this.repository.get(code)) code = randomText(6);
    const token = `${randomText(12)}-${randomText(20)}`;
    const now = new Date().toISOString();
    const room: StoredRoom = {
      code,
      status: game.result ? "complete" : "active",
      revision: 1,
      game: structuredClone(game),
      hostTokenHash: await hashToken(token),
      seats: game.players.map((player) =>
        player.id === 0
          ? {
              playerId: player.id,
              displayName: displayName.trim().slice(0, 40) || "Host",
              tokenHash: "pending",
              joinedAt: now,
            }
          : {
              playerId: player.id,
              displayName: null,
              tokenHash: null,
              joinedAt: null,
            },
      ),
      createdAt: now,
      updatedAt: now,
    };
    room.seats[0].tokenHash = room.hostTokenHash;
    await this.repository.put(room);
    return {
      code,
      token,
      role: "host",
      revision: room.revision,
      summary: summary(room),
      game: structuredClone(game),
    };
  }

  async join(
    code: string,
    playerId: number,
    displayName: string,
  ): Promise<RoomSession> {
    const room = await this.requireRoom(code);
    const seat = room.seats[playerId];
    if (!seat) throw new Error("That player seat does not exist.");
    if (seat.tokenHash) throw new Error("That player seat is already claimed.");
    const token = `${randomText(12)}-${randomText(20)}`;
    seat.displayName = displayName.trim().slice(0, 40) || `Player ${playerId + 1}`;
    seat.tokenHash = await hashToken(token);
    seat.joinedAt = new Date().toISOString();
    room.updatedAt = seat.joinedAt;
    await this.repository.put(room);
    return {
      code: room.code,
      token,
      role: "player",
      playerId,
      revision: room.revision,
      summary: summary(room),
      game: projectPrivateGame(room.game, playerId),
    };
  }

  async resume(code: string, token: string): Promise<RoomSession> {
    const room = await this.requireRoom(code);
    const tokenHash = await hashToken(token);
    if (tokenHash === room.hostTokenHash)
      return {
        code: room.code,
        token,
        role: "host",
        revision: room.revision,
        summary: summary(room),
        game: structuredClone(room.game),
      };
    const seat = room.seats.find((candidate) => candidate.tokenHash === tokenHash);
    if (!seat) throw new Error("That resume token is not valid for this room.");
    return {
      code: room.code,
      token,
      role: "player",
      playerId: seat.playerId,
      revision: room.revision,
      summary: summary(room),
      game: projectPrivateGame(room.game, seat.playerId),
    };
  }

  async save(
    code: string,
    token: string,
    expectedRevision: number,
    game: GameState,
  ): Promise<RoomSession> {
    const room = await this.requireRoom(code);
    if ((await hashToken(token)) !== room.hostTokenHash)
      throw new Error("Only the room host may publish a local playtest state.");
    if (room.revision !== expectedRevision)
      throw new Error(
        `Room changed from revision ${expectedRevision} to ${room.revision}. Resume before publishing again.`,
      );
    validateGame(game);
    if (
      game.seed !== room.game.seed ||
      game.mapId !== room.game.mapId ||
      game.players.length !== room.game.players.length ||
      game.players.some(
        (player, index) => player.faction !== room.game.players[index].faction,
      )
    )
      throw new Error("A room save cannot replace its map, seed, or seats.");
    room.game = structuredClone(game);
    room.revision++;
    room.status = game.result ? "complete" : "active";
    room.updatedAt = new Date().toISOString();
    await this.repository.put(room);
    return {
      code: room.code,
      token,
      role: "host",
      revision: room.revision,
      summary: summary(room),
      game: structuredClone(room.game),
    };
  }

  private async requireRoom(rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    const room = await this.repository.get(code);
    if (!room) throw new Error("No Horizon room uses that invitation code.");
    return room;
  }
}
