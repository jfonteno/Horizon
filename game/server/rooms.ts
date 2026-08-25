import type { GameState, PlayerController } from "../types";
import { factionLibrary } from "../factions";
import { mapLibrary } from "../maps";
import { projectPrivateGame, projectSpectatorGame } from "./private-view";
import type {
  AuthenticatedRoomSeat,
  RoomMode,
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

export async function hashRoomToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function normalizeRoomCode(rawCode: string) {
  return rawCode.trim().toUpperCase();
}

function cloneController(controller: PlayerController): PlayerController {
  return controller.kind === "bot"
    ? { kind: "bot", profileId: controller.profileId }
    : { kind: "human" };
}

function validateGame(game: GameState) {
  if (!mapLibrary[game.mapId]) throw new Error(`Map ${game.mapId} is not installed on this server.`);
  const missingFaction = game.players.find((player) => !factionLibrary[player.faction]);
  if (missingFaction) throw new Error(`Faction ${missingFaction.faction} is not installed on this server.`);
  for (const required of game.contentPacks || []) {
    const installedVersion = mapLibrary[game.mapId]?.sourcePack === required.id
      ? mapLibrary[game.mapId].sourcePackVersion
      : game.players
          .map((player) => factionLibrary[player.faction])
          .find((definition) => definition?.sourcePack === required.id)?.sourcePackVersion;
    if (installedVersion !== required.version)
      throw new Error(`Content pack ${required.id}@${required.version} is required by this game.`);
  }
  if (game.players.length < 4 || game.players.length > 6)
    throw new Error("Network rooms support four to six civilizations.");
  if (game.players.some((player, index) => player.id !== index))
    throw new Error("Player seats must use consecutive identifiers.");
  if (game.active < 0 || game.active >= game.players.length)
    throw new Error("The active civilization is invalid.");
  if (game.turn < 1 || game.turn > 16 || game.era < 1 || game.era > 4)
    throw new Error("The Turn or Era is outside the four-Era playtest range.");
}

/**
 * Older 0.13 room payloads predate RoomMode and explicit seat controllers.
 * Normalize them when read so existing local rooms continue to work.
 */
export function normalizeStoredRoom(room: StoredRoom): StoredRoom {
  const candidate = room as StoredRoom & {
    schemaVersion?: number;
    mode?: RoomMode;
    events?: StoredRoom["events"];
    commandReceipts?: StoredRoom["commandReceipts"];
    seats: Array<
      StoredRoom["seats"][number] & { controller?: PlayerController; ready?: boolean }
    >;
  };

  candidate.schemaVersion ||= 1;
  candidate.mode ||= "local";
  candidate.events ||= [];
  candidate.commandReceipts ||= [];
  candidate.seats = candidate.seats.map((seat) => ({
    ...seat,
    controller: cloneController(
      seat.controller ?? candidate.game.players[seat.playerId]?.controller ?? { kind: "human" },
    ),
    ready: seat.ready ?? (seat.controller?.kind === "bot"),
  }));

  candidate.schemaVersion = 2;

  return candidate;
}

function summary(room: StoredRoom): RoomSummary {
  return {
    code: room.code,
    mode: room.mode,
    status: room.status,
    revision: room.revision,
    turn: room.game.turn,
    era: room.game.era,
    activePlayerId: room.game.active,
    seats: room.seats.map((seat) => ({
      playerId: seat.playerId,
      civilization: room.game.players[seat.playerId].name,
      faction: room.game.players[seat.playerId].faction,
      controller: cloneController(seat.controller),
      displayName: seat.displayName,
      claimed: seat.controller.kind === "bot" || Boolean(seat.tokenHash),
      ready: seat.controller.kind === "bot" || seat.ready,
      ordersSubmitted: room.game.orderProtocol.submissions.some((submission) => submission.playerId === seat.playerId),
    })),
    recentEvents: room.events.slice(-30),
    updatedAt: room.updatedAt,
  };
}

function sessionGame(room: StoredRoom, playerId: number | undefined, host: boolean) {
  if (room.mode === "local" && host) return structuredClone(room.game);
  if (playerId === undefined)
    throw new Error("A network room session must be attached to a human seat.");
  return projectPrivateGame(room.game, playerId);
}

export class MemoryRoomRepository implements RoomRepository {
  readonly kind = "memory" as const;
  private rooms = new Map<string, StoredRoom>();

  async health() { return { ok: true, detail: "ephemeral" }; }

  async get(code: string) {
    const room = this.rooms.get(normalizeRoomCode(code));
    return room ? normalizeStoredRoom(structuredClone(room)) : null;
  }

  async put(room: StoredRoom) {
    const normalized = normalizeStoredRoom(structuredClone(room));
    this.rooms.set(normalized.code, normalized);
  }

  async compareAndSwap(room: StoredRoom, expectedRevision: number) {
    const current = this.rooms.get(normalizeRoomCode(room.code));
    if (!current || current.revision !== expectedRevision) return false;
    await this.put(room);
    return true;
  }
}

export class RoomService {
  constructor(private repository: RoomRepository) {}

  async create(
    game: GameState,
    displayName: string,
    mode: RoomMode = "local",
  ): Promise<RoomSession> {
    validateGame(game);

    const hostPlayer =
      mode === "network"
        ? game.players.find((player) => player.controller.kind === "human")
        : game.players[0];

    if (!hostPlayer)
      throw new Error("A network room requires at least one human civilization.");

    let code = randomText(6);
    while (await this.repository.get(code)) code = randomText(6);

    const token = `${randomText(12)}-${randomText(20)}`;
    const hostTokenHash = await hashRoomToken(token);
    const now = new Date().toISOString();

    const room: StoredRoom = {
      schemaVersion: 2,
      code,
      mode,
      status: game.result ? "complete" : mode === "network" ? "lobby" : "active",
      revision: 1,
      game: structuredClone(game),
      hostTokenHash,
      seats: game.players.map((player) => {
        const controller = cloneController(player.controller);
        const isHostSeat = player.id === hostPlayer.id;

        if (controller.kind === "bot") {
          return {
            playerId: player.id,
            controller,
            displayName: player.name,
            tokenHash: null,
            joinedAt: null,
            ready: true,
          };
        }

        return {
          playerId: player.id,
          controller,
          displayName: isHostSeat
            ? displayName.trim().slice(0, 40) || "Host"
            : null,
          tokenHash: isHostSeat ? hostTokenHash : null,
          joinedAt: isHostSeat ? now : null,
          ready: false,
        };
      }),
      events: [{
        id: `room-created-${now}`,
        at: now,
        revision: 1,
        type: "system",
        message: mode === "network" ? "Network lobby created." : "Local room created.",
      }],
      commandReceipts: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.put(room);

    return {
      code,
      token,
      role: "host",
      playerId: hostPlayer.id,
      revision: room.revision,
      summary: summary(room),
      game: sessionGame(room, hostPlayer.id, true),
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
    if (seat.controller.kind === "bot")
      throw new Error("That civilization is controlled by a bot.");
    if (seat.tokenHash) throw new Error("That player seat is already claimed.");

    const token = `${randomText(12)}-${randomText(20)}`;
    seat.displayName =
      displayName.trim().slice(0, 40) || `Player ${playerId + 1}`;
    seat.tokenHash = await hashRoomToken(token);
    seat.joinedAt = new Date().toISOString();
    seat.ready = false;
    const expectedRevision = room.revision;
    room.revision++;
    room.updatedAt = seat.joinedAt;
    room.events.push({
      id: `seat-${playerId}-${room.revision}`,
      at: room.updatedAt,
      revision: room.revision,
      type: "seat",
      playerId,
      message: `${seat.displayName} claimed ${room.game.players[playerId].name}.`,
    });

    if (!(await this.repository.compareAndSwap(room, expectedRevision)))
      throw new Error("The room changed while that seat was being claimed. Refresh and retry.");

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
    const tokenHash = await hashRoomToken(token);
    const isHost = tokenHash === room.hostTokenHash;

    const seat = room.seats.find(
      (candidate) =>
        candidate.controller.kind === "human" &&
        candidate.tokenHash === tokenHash,
    );

    if (!seat && !(room.mode === "local" && isHost))
      throw new Error("That resume token is not valid for this room.");

    const playerId = seat?.playerId;

    return {
      code: room.code,
      token,
      role: isHost ? "host" : "player",
      playerId,
      revision: room.revision,
      summary: summary(room),
      game: sessionGame(room, playerId, isHost),
    };
  }

  async spectate(code: string): Promise<RoomSession> {
    const room = await this.requireRoom(code);
    if (room.mode !== "network")
      throw new Error("Only network rooms provide a spectator view.");
    return {
      code: room.code,
      token: "",
      role: "spectator",
      revision: room.revision,
      summary: summary(room),
      game: projectSpectatorGame(room.game),
    };
  }

  /**
   * Preserve the existing local/hotseat publication path.
   * Network rooms must mutate state through authenticated commands instead.
   */
  async save(
    code: string,
    token: string,
    expectedRevision: number,
    game: GameState,
  ): Promise<RoomSession> {
    const room = await this.requireRoom(code);

    if (room.mode !== "local")
      throw new Error(
        "Network rooms are server-authoritative. Submit a room command instead of publishing GameState.",
      );

    if ((await hashRoomToken(token)) !== room.hostTokenHash)
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

    if (!(await this.repository.compareAndSwap(room, expectedRevision)))
      throw new Error("The room changed while this state was being published. Resume and retry.");

    return {
      code: room.code,
      token,
      role: "host",
      playerId: room.seats.find(
        (seat) => seat.tokenHash === room.hostTokenHash,
      )?.playerId,
      revision: room.revision,
      summary: summary(room),
      game: structuredClone(room.game),
    };
  }

  /**
   * Used by the command layer to authenticate a network player without exposing
   * token hashes to API routes or UI code.
   */
  async authenticateSeat(
    code: string,
    token: string,
  ): Promise<AuthenticatedRoomSeat> {
    const room = await this.requireRoom(code);
    const tokenHash = await hashRoomToken(token);
    const seat = room.seats.find(
      (candidate) =>
        candidate.controller.kind === "human" &&
        candidate.tokenHash === tokenHash,
    );

    if (!seat) throw new Error("That room token is not valid for a human seat.");

    return {
      room,
      role: tokenHash === room.hostTokenHash ? "host" : "player",
      playerId: seat.playerId,
    };
  }

  async getStoredRoom(code: string) {
    return this.requireRoom(code);
  }

  async writeStoredRoom(room: StoredRoom) {
    await this.repository.put(room);
  }

  private async requireRoom(rawCode: string) {
    const code = normalizeRoomCode(rawCode);
    const raw = await this.repository.get(code);
    if (!raw) throw new Error("No Horizon room uses that invitation code.");
    const room = normalizeStoredRoom(raw);
    validateGame(room.game);
    return room;
  }
}
