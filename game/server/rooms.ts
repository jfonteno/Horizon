import type { GameState, PlayerController } from "../types";
import { factionIds, factionLibrary } from "../factions";
import { mapLibrary } from "../maps";
import { projectPrivateGame, projectSpectatorGame } from "./private-view";
import { appendSystemAudit, initializeRoomAudit } from "./audit";
import { reconcileExpiredTurnTimer } from "./turn-timer";
import { createInitialChat, normalizeChat, projectChatModeration, projectRoomChat } from "./chat";
import { finalEra, totalTurns } from "../rules/format";
import { emptyLegacyMetrics, prepareHiddenChoicesForEra } from "../rules/legacy";
import { normalizeTradeBundles } from "../rules/diplomacy";
import { availableFactionsForHost } from "../entitlements";
import { createGame } from "../engine/create-game";
import { eraPolicyChoices } from "../rules/policy-deck";
import type {
  AuthenticatedRoomSeat,
  RoomMode,
  RoomAttention,
  RoomPhase,
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

function validateGame(game: GameState, mode: RoomMode) {
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
  if (mode === "network" && (game.players.length < 4 || game.players.length > 6))
    throw new Error("Network rooms support four to six civilizations.");
  if (mode === "local" && (game.players.length < 1 || game.players.length > 6))
    throw new Error("Local rooms support one to six civilizations.");
  if (game.players.some((player, index) => player.id !== index))
    throw new Error("Player seats must use consecutive identifiers.");
  if (game.active < 0 || game.active >= game.players.length)
    throw new Error("The active civilization is invalid.");
  if (game.turn < 1 || game.turn > totalTurns(game) || game.era < 1 || game.era > finalEra(game))
    throw new Error("The Turn or Era is outside the selected game format.");
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
    audit?: StoredRoom["audit"];
    drafts?: StoredRoom["drafts"];
    availableFactions?: StoredRoom["availableFactions"];
    enabledExpansions?: StoredRoom["enabledExpansions"];
    turnTimerSeconds?: number | null;
    autoStartWhenReady?: boolean;
    turnDeadlineAt?: string | null;
    turnTimerPausedRemainingMs?: number | null;
    chat?: StoredRoom["chat"];
    gatePledges?: StoredRoom["gatePledges"];
    feedback?: StoredRoom["feedback"];
    seats: Array<
      StoredRoom["seats"][number] & { controller?: PlayerController; ready?: boolean; selectedFaction?: string | null }
    >;
  };

  candidate.schemaVersion ||= 1;
  candidate.name = candidate.name?.trim().slice(0, 48) || candidate.code;
  candidate.game.format ||= "four-era";
  const gameSchemaVersion = candidate.game.schemaVersion || 1;
  const playableHexes = candidate.game.hexes.filter((hex) => hex.kind !== "rift").length;
  if (candidate.game.mapId === "standard-board" && playableHexes === 91)
    candidate.game.mapId = "standard-board-91";
  else if (candidate.game.mapId === "standard-board" && gameSchemaVersion < 16)
    candidate.game.mapId = "standard-board-61";
  else if (candidate.game.mapId === "shattered-reach" && gameSchemaVersion < 16)
    candidate.game.mapId = "shattered-reach-legacy";
  candidate.game.schemaVersion = 21;
  candidate.game.policyElection ||= { era: candidate.game.era, choices: eraPolicyChoices(candidate.game.seed, candidate.game.era), votes: [] };
  candidate.game.brokerageOffers ||= [];
  candidate.game.stationingPermissions ||= [];
  candidate.game.pendingCombatRedistributions ||= [];
  candidate.game.mobileHabitats ||= [];
  candidate.game.blockades ||= [];
  candidate.game.blockades = candidate.game.blockades.map((blockade) => {
    const carrier = blockade.carrierId
      ? candidate.game.carriers.find((candidateCarrier) => candidateCarrier.id === blockade.carrierId)
      : undefined;
    return carrier
      ? { ...blockade, owner: carrier.owner, hex: carrier.hex, active: false }
      : { ...blockade, carrierId: undefined };
  });
  candidate.game.bombardmentDamage ||= {};
  candidate.game.bombardmentsThisTurn ||= {};
  candidate.game.bombardmentMarks ||= [];
  candidate.game.hexes = candidate.game.hexes.map((hex) => ({
    ...hex,
    tier: hex.tier === "Metropolis" && candidate.game.players[hex.originalOwner ?? hex.owner ?? -1]?.faction === "spires" ? "Arcology" as const : hex.tier,
    arcologyOrigin: hex.tier === "Metropolis" && candidate.game.players[hex.originalOwner ?? hex.owner ?? -1]?.faction === "spires" ? "spires" : hex.arcologyOrigin,
    kind: hex.kind === "hazard" ? "empty" : hex.kind,
    originalOwner: hex.originalOwner ?? (hex.owner !== undefined && hex.tier ? hex.owner : undefined),
  }));
  candidate.game.players = candidate.game.players.map((player) => {
    const defaults = emptyLegacyMetrics();
    return {
      ...player,
      laborPenalty: player.laborPenalty || 0,
      eraTributes: [...(player.eraTributes || []), 0, 0, 0, 0, 0].slice(0, 5),
      legacyMetrics: { ...defaults, ...(player.legacyMetrics || {}) },
      // An explicitly empty list means the last Explorer was destroyed. Only
      // synthesize the legacy primary vessel for saves that predate this list.
      explorationVessels: Array.isArray(player.explorationVessels) ? player.explorationVessels : [{
        id: `exploration-${player.id}-1`, owner: player.id, type: "exploration" as const,
        hex: player.explorer, readyTurn: candidate.game.turn, movesRemaining: candidate.game.moves?.explorer ?? 1,
      }],
      colonyShips: Array.isArray(player.colonyShips) ? player.colonyShips : player.colonyShip ? [{
        id: `colony-${player.id}-1`, owner: player.id, hex: player.colonyShip,
        readyTurn: candidate.game.turn, movesRemaining: candidate.game.moves?.colony ?? 1,
      }] : [],
      colonyShip: Array.isArray(player.colonyShips) ? player.colonyShips[0]?.hex || "" : player.colonyShip || "",
    };
  });
  prepareHiddenChoicesForEra(candidate.game, candidate.game.era);
  candidate.game.proposals = candidate.game.proposals.map((proposal) => {
    if (proposal.kind !== "trade") return proposal;
    const normalized = normalizeTradeBundles(proposal.offer, proposal.request);
    return { ...proposal, ...normalized, counterDepth: proposal.counterDepth ?? 0 };
  });
  candidate.mode ||= "local";
  candidate.events ||= [];
  candidate.commandReceipts ||= [];
  candidate.audit ||= [];
  candidate.drafts ||= [];
  candidate.availableFactions ||= [...new Set(candidate.game.players.map((player) => player.faction))];
  candidate.enabledExpansions ||= candidate.game.enabledExpansions || ((candidate.game.contentPacks || []).some((pack) => pack.id === "shattered-reach-expansion") || candidate.game.players.some((player) => ["spires", "aegis", "wayfarers", "salvo", "guilds"].includes(player.faction)) ? ["shattered-reach-expansion"] : []);
  candidate.game.enabledExpansions = candidate.enabledExpansions;
  candidate.turnTimerSeconds ??= null;
  candidate.autoStartWhenReady ??= false;
  candidate.turnDeadlineAt ??= null;
  candidate.turnTimerPausedRemainingMs ??= null;
  candidate.seats = candidate.seats.map((seat) => ({
    ...seat,
    controller: cloneController(
      seat.controller ?? candidate.game.players[seat.playerId]?.controller ?? { kind: "human" },
    ),
    ready: seat.ready ?? (seat.controller?.kind === "bot"),
    selectedFaction: seat.selectedFaction === undefined
      ? candidate.game.players[seat.playerId]?.faction || null
      : seat.selectedFaction,
    randomFaction: Boolean(seat.randomFaction),
    accountId: seat.tokenHash && seat.controller?.kind !== "bot" ? seat.accountId || null : null,
    commanderEmblem: seat.commanderEmblem || "horizon",
  }));

  candidate.hostAccountId ||= null;
  normalizeChat(candidate);
  candidate.gatePledges ||= [];
  candidate.feedback ||= [];
  candidate.schemaVersion = 12;

  return candidate;
}

function roomPhase(room: StoredRoom): RoomPhase {
  if (room.status === "lobby") return "lobby";
  if (room.status === "paused") return "paused";
  if (room.status === "complete" || room.game.result) return "complete";
  if (room.game.pendingCenterLoss || room.game.pendingCombatRedistributions.length) return "mandatory-decision";
  if (room.game.orderProtocol.phase === "negotiation") return "negotiation";
  if (room.game.orderProtocol.phase === "orders") return "orders";
  return "resolving";
}

export function roomAttention(room: StoredRoom, playerId: number | undefined): RoomAttention[] {
  if (playerId === undefined) return [];
  const items: RoomAttention[] = [];
  const player = room.game.players[playerId];
  const seat = room.seats[playerId];
  if (room.status === "lobby" && seat?.controller.kind === "human" && (!seat.selectedFaction || !seat.ready))
    items.push({ id: `ready:${playerId}`, kind: "ready", title: "Prepare your seat", detail: seat.selectedFaction ? "Confirm your faction and mark Ready." : "Choose an available faction before the room can begin.", turn: room.game.turn });
  if (room.status === "active" && player) {
    if ((room.game.turn - 1) % 4 === 0 && !player.hiddenLegacy[room.game.era]?.selected)
      items.push({ id: `hidden:${room.game.era}`, kind: "hidden", title: "Choose a Hidden Legacy", detail: `Select your private Era ${room.game.era} objective before issuing commands.`, turn: room.game.turn });
    const proposals = room.game.proposals.filter((proposal) => proposal.status === "pending" && (proposal.kind === "technology" ? proposal.buyer === playerId : proposal.to === playerId));
    if (proposals.length)
      items.push({ id: `proposal:${proposals.map((proposal) => proposal.id).join(",")}`, kind: "proposal", title: "Diplomatic response required", detail: `${proposals.length} proposal${proposals.length === 1 ? " is" : "s are"} awaiting your response.`, turn: room.game.turn });
    const brokerage = (room.game.brokerageOffers || []).filter((offer) => offer.status === "pending" && offer.createdTurn === room.game.turn &&
      [offer.a, offer.b].includes(playerId) && !offer.approvedBy.includes(playerId));
    if (brokerage.length)
      items.push({ id: `brokerage:${brokerage.map((offer) => offer.id).join(",")}`, kind: "proposal", title: "Brokerage approval required", detail: `${brokerage.length} brokered exchange${brokerage.length === 1 ? " needs" : "s need"} your consent.`, turn: room.game.turn });
    if (room.game.pendingCenterLoss?.playerId === playerId)
      items.push({ id: `capture:${room.game.pendingCenterLoss.hexId}:${room.game.turn}`, kind: "capture", title: "Resolve a captured Habitat", detail: "Choose which Center is destroyed before play can continue.", turn: room.game.turn });
    if (room.game.pendingCombatRedistributions.some((pending) => pending.playerId === playerId))
      items.push({ id: `redistribution:${room.game.turn}:${playerId}`, kind: "redistribution", title: "Redistribute surviving forces", detail: "Assign surviving Combat Units before play can continue.", turn: room.game.turn });
    const sealed = room.game.orderProtocol.submissions.some((submission) => submission.playerId === playerId);
    if (["negotiation", "orders"].includes(room.game.orderProtocol.phase) && !sealed)
      items.push({ id: `orders:${room.game.turn}`, kind: "orders", title: "Orders are open", detail: room.turnDeadlineAt ? `Seal before ${room.turnDeadlineAt}.` : "Draft and seal your Orders when negotiations are complete.", turn: room.game.turn });
  }
  const chat = projectRoomChat(room, playerId);
  const messageCount = chat.channels.filter((channel) => channel.kind !== "system" && !channel.mutedBy.includes(playerId))
    .reduce((sum, channel) => sum + (chat.unreadByChannel[channel.id] || 0), 0);
  if (messageCount) items.push({ id: `message:${Math.max(0, ...chat.messages.map((message) => message.sequence))}`, kind: "message", title: "Unread match messages", detail: `${messageCount} unread message${messageCount === 1 ? "" : "s"} across your conversations.`, turn: room.game.turn });
  return items;
}

function summary(room: StoredRoom): RoomSummary {
  return {
    code: room.code,
    name: room.name?.trim() || room.code,
    mode: room.mode,
    status: room.status,
    phase: roomPhase(room),
    revision: room.revision,
    turn: room.game.turn,
    era: room.game.era,
    activePlayerId: room.game.active,
    hostPlayerId: room.seats.find((seat) => seat.tokenHash === room.hostTokenHash)?.playerId ?? null,
    turnTimerSeconds: room.turnTimerSeconds,
    autoStartWhenReady: room.autoStartWhenReady,
    turnDeadlineAt: room.turnDeadlineAt,
    enabledExpansions: room.enabledExpansions,
    availableFactions: room.availableFactions.map((id) => {
      const faction = factionLibrary[id];
      return faction ? {
        id, name: faction.name, role: faction.role, color: faction.color, logo: faction.logo,
        blurb: faction.blurb, lore: faction.lore, abilities: faction.abilities,
        objectives: faction.objectives, homeProduction: faction.homeProduction,
      } : { id, name: id, role: "Unavailable content", color: "#718896" };
    }),
    seats: room.seats.map((seat) => ({
      playerId: seat.playerId,
      civilization: seat.selectedFaction ? factionLibrary[seat.selectedFaction]?.name || seat.selectedFaction : seat.randomFaction ? "Random faction" : "Faction unselected",
      faction: seat.selectedFaction,
      controller: cloneController(seat.controller),
      displayName: seat.displayName,
      claimed: seat.controller.kind === "bot" || Boolean(seat.tokenHash),
      ready: seat.controller.kind === "bot" || seat.ready,
      randomFaction: Boolean(seat.randomFaction),
      commanderEmblem: seat.commanderEmblem || "horizon",
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

function sessionDraft(room: StoredRoom, playerId: number | undefined) {
  if (playerId === undefined) return undefined;
  return structuredClone(room.drafts.find((draft) => draft.playerId === playerId && draft.turn === room.game.turn)?.orders || []);
}

function sessionFeedback(room: StoredRoom, playerId: number | undefined) {
  if (playerId === undefined) return undefined;
  const feedback = room.feedback.find((entry) => entry.playerId === playerId);
  return feedback ? structuredClone(feedback) : undefined;
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

  async delete(code: string, expectedRevision: number) {
    const key = normalizeRoomCode(code), room = this.rooms.get(key);
    if (!room || room.revision !== expectedRevision) return false;
    return this.rooms.delete(key);
  }

  async findByAccount(accountId: string) {
    return [...this.rooms.values()]
      .filter((room) => room.hostAccountId === accountId || room.seats.some((seat) => seat.accountId === accountId))
      .map((room) => normalizeStoredRoom(structuredClone(room)));
  }

  async list() {
    return [...this.rooms.values()].map((room) => normalizeStoredRoom(structuredClone(room)));
  }
}

export class RoomService {
  constructor(private repository: RoomRepository) {}

  async create(
    game: GameState,
    displayName: string,
    mode: RoomMode = "local",
    accountId: string | null = null,
    commanderEmblem = "horizon",
    autoStartWhenReady = false,
    roomName = "",
  ): Promise<RoomSession> {
    validateGame(game, mode);

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

    const reservedBotFactions = new Set<string>();
    const room: StoredRoom = {
      schemaVersion: 12,
      code,
      name: roomName.trim().slice(0, 48) || code,
      mode,
      status: game.result ? "complete" : mode === "network" ? "lobby" : "active",
      revision: 1,
      game: structuredClone(game),
      initialGame: structuredClone(game),
      enabledExpansions: game.enabledExpansions || [],
      availableFactions: availableFactionsForHost(game.enabledExpansions || []),
      hostTokenHash,
      hostAccountId: accountId,
      seats: game.players.map((player) => {
        const controller = cloneController(player.controller);
        const isHostSeat = player.id === hostPlayer.id;

        if (controller.kind === "bot") {
          const selectedFaction = !reservedBotFactions.has(player.faction)
            ? player.faction
            : factionIds.find((id) => !reservedBotFactions.has(id));
          if (!selectedFaction)
            throw new Error("The room does not have enough installed factions for every bot seat.");
          reservedBotFactions.add(selectedFaction);
          return {
            playerId: player.id,
            controller,
            displayName: player.name,
            tokenHash: null,
            joinedAt: null,
            ready: true,
            selectedFaction: mode === "network" ? null : selectedFaction,
            randomFaction: mode === "network",
            accountId: null,
            commanderEmblem: "horizon",
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
          selectedFaction: mode === "network" ? null : player.faction,
          randomFaction: false,
          accountId: isHostSeat ? accountId : null,
          commanderEmblem: isHostSeat ? commanderEmblem : "horizon",
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
      audit: [],
      drafts: [],
      turnTimerSeconds: null,
      autoStartWhenReady: mode === "network" && autoStartWhenReady,
      turnDeadlineAt: null,
      turnTimerPausedRemainingMs: null,
      chat: undefined as unknown as StoredRoom["chat"],
      gatePledges: [],
      feedback: [],
      createdAt: now,
      updatedAt: now,
    };

    room.chat = createInitialChat(room);

    await initializeRoomAudit(room);

    await this.repository.put(room);

    return {
      code,
      token,
      role: "host",
      playerId: hostPlayer.id,
      revision: room.revision,
      summary: summary(room),
      game: sessionGame(room, hostPlayer.id, true),
      privateDraft: [],
      attention: roomAttention(room, hostPlayer.id),
      chat: projectRoomChat(room, hostPlayer.id),
      gatePledges: structuredClone(room.gatePledges),
      feedback: sessionFeedback(room, hostPlayer.id),
      moderation: projectChatModeration(room),
    };
  }

  async join(
    code: string,
    playerId: number,
    displayName: string,
    accountId: string | null = null,
    commanderEmblem = "horizon",
  ): Promise<RoomSession> {
    const room = await this.requireRoom(code);
    const requestedSeat = playerId < 0
      ? room.seats.find((candidate) => candidate.controller.kind === "human" && !candidate.tokenHash)
      : room.seats[playerId];
    const seat = requestedSeat;

    if (accountId && room.seats.some((candidate) => candidate.accountId === accountId))
      throw new Error("This commander profile already controls a seat in that room.");
    if (!seat) throw new Error("That player seat does not exist.");
    if (seat.controller.kind === "bot")
      throw new Error("That civilization is controlled by a bot.");
    if (seat.tokenHash) throw new Error("That player seat is already claimed.");
    playerId = seat.playerId;

    const token = `${randomText(12)}-${randomText(20)}`;
    seat.displayName =
      displayName.trim().slice(0, 40) || `Player ${seat.playerId + 1}`;
    seat.tokenHash = await hashRoomToken(token);
    seat.joinedAt = new Date().toISOString();
    seat.ready = false;
    seat.accountId = accountId;
    seat.commanderEmblem = commanderEmblem;
    const expectedRevision = room.revision;
    room.revision++;
    room.updatedAt = seat.joinedAt;
    room.events.push({
      id: `seat-${playerId}-${room.revision}`,
      at: room.updatedAt,
      revision: room.revision,
      type: "seat",
      playerId,
      message: `${seat.displayName} claimed seat ${playerId + 1}.`,
    });
    await appendSystemAudit(room, `seat-claim-${room.revision}`, "seatClaimed", "Claim human seat", { playerId });

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
      privateDraft: sessionDraft(room, playerId),
      attention: roomAttention(room, playerId),
      chat: projectRoomChat(room, playerId),
      gatePledges: structuredClone(room.gatePledges),
      feedback: sessionFeedback(room, playerId),
    };
  }

  async resume(code: string, token: string): Promise<RoomSession> {
    await reconcileExpiredTurnTimer(this.repository, normalizeRoomCode(code));
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

    const playerId = room.mode === "local" && isHost ? room.game.spectatorMode ? undefined : room.game.active : seat?.playerId;

    return {
      code: room.code,
      token,
      role: isHost ? "host" : "player",
      playerId,
      revision: room.revision,
      summary: summary(room),
      game: sessionGame(room, playerId, isHost),
      privateDraft: sessionDraft(room, playerId),
      attention: roomAttention(room, playerId),
      chat: projectRoomChat(room, playerId),
      gatePledges: structuredClone(room.gatePledges),
      feedback: sessionFeedback(room, playerId),
      moderation: isHost ? projectChatModeration(room) : undefined,
    };
  }

  async resumeByAccount(code: string, accountId: string): Promise<RoomSession> {
    await reconcileExpiredTurnTimer(this.repository, normalizeRoomCode(code));
    const room = await this.requireRoom(code);
    const seat = room.seats.find((candidate) => candidate.controller.kind === "human" && candidate.tokenHash && candidate.accountId === accountId);
    if (!seat) throw new Error("This profile is not linked to a human seat in that room.");

    const token = `${randomText(12)}-${randomText(20)}`;
    const tokenHash = await hashRoomToken(token);
    const expectedRevision = room.revision;
    const isHost = room.hostAccountId === accountId;
    seat.tokenHash = tokenHash;
    if (isHost) room.hostTokenHash = tokenHash;
    room.revision++;
    room.updatedAt = new Date().toISOString();
    room.events.push({
      id: `profile-recovery-${seat.playerId}-${room.revision}`,
      at: room.updatedAt,
      revision: room.revision,
      type: "seat",
      playerId: seat.playerId,
      message: `${seat.displayName || `Player ${seat.playerId + 1}`} recovered this seat through a commander profile.`,
    });
    await appendSystemAudit(room, `seat-recovery-${room.revision}`, "seatRecovered", "Recover commander seat", { playerId: seat.playerId });
    if (!(await this.repository.compareAndSwap(room, expectedRevision)))
      throw new Error("The room changed during profile recovery. Retry the recovery request.");

    return {
      code: room.code,
      token,
      role: isHost ? "host" : "player",
      playerId: seat.playerId,
      revision: room.revision,
      summary: summary(room),
      game: sessionGame(room, seat.playerId, isHost),
      privateDraft: sessionDraft(room, seat.playerId),
      attention: roomAttention(room, seat.playerId),
      chat: projectRoomChat(room, seat.playerId),
      gatePledges: structuredClone(room.gatePledges),
      feedback: sessionFeedback(room, seat.playerId),
      moderation: isHost ? projectChatModeration(room) : undefined,
    };
  }

  async spectate(code: string): Promise<RoomSession> {
    await reconcileExpiredTurnTimer(this.repository, normalizeRoomCode(code));
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
      attention: [],
      chat: projectRoomChat(room, undefined),
      gatePledges: structuredClone(room.gatePledges),
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

    validateGame(game, "local");

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
    await appendSystemAudit(room, `local-publish-${room.revision}`, "localPublish", "Publish local game state", { turn: game.turn });

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
      privateDraft: sessionDraft(room, room.game.active),
      attention: roomAttention(room, room.game.active),
      chat: projectRoomChat(room, room.game.active),
      gatePledges: structuredClone(room.gatePledges),
      feedback: sessionFeedback(room, room.game.active),
      moderation: projectChatModeration(room),
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

  async authenticateHost(code: string, token: string) {
    const room = await this.requireRoom(code);
    if ((await hashRoomToken(token)) !== room.hostTokenHash)
      throw new Error("Only the room host may access this playtest record.");
    return room;
  }

  async createRematch(code: string, token: string, accountId: string | null = null) {
    const previous = await this.authenticateHost(code, token);
    if (previous.mode !== "network" || previous.status !== "complete" || !previous.game.result)
      throw new Error("A rematch can be created only from a completed network game.");
    const hostSeat = previous.seats.find((seat) => seat.tokenHash === previous.hostTokenHash);
    if (!hostSeat) throw new Error("The completed room no longer has a host seat.");
    const factions = previous.seats.map((seat) => seat.selectedFaction || previous.game.players[seat.playerId].faction);
    const controllers = previous.seats.map((seat) => cloneController(seat.controller));
    const fresh = createGame(
      previous.game.players.length,
      factions,
      previous.game.mapId,
      previous.game.themeId,
      Math.floor(Date.now() % 1_000_000_000),
      controllers,
      false,
      previous.game.format,
    );
    const rematchName = previous.name && previous.name !== previous.code ? `${previous.name} Rematch`.slice(0, 48) : "";
    const created = await this.create(fresh, hostSeat.displayName || "Host", "network", accountId || previous.hostAccountId || null, "horizon", previous.autoStartWhenReady, rematchName);
    const rematch = await this.requireRoom(created.code);
    const expectedRevision = rematch.revision;
    rematch.availableFactions = [...previous.availableFactions];
    rematch.turnTimerSeconds = previous.turnTimerSeconds;
    rematch.autoStartWhenReady = previous.autoStartWhenReady;
    for (const seat of rematch.seats) {
      seat.selectedFaction = factions[seat.playerId];
      seat.ready = seat.controller.kind === "bot";
    }
    rematch.revision++;
    rematch.updatedAt = new Date().toISOString();
    rematch.events.push({
      id: `rematch-${previous.code}-${rematch.revision}`,
      at: rematch.updatedAt,
      revision: rematch.revision,
      type: "system",
      message: `Rematch lobby created from room ${previous.code}.`,
    });
    await appendSystemAudit(rematch, `rematch-${rematch.revision}`, "rematchPrepared", "Prepare rematch lobby", { playerCount: rematch.seats.length });
    if (!(await this.repository.compareAndSwap(rematch, expectedRevision)))
      throw new Error("The rematch lobby changed while it was being prepared. Retry from the completed game.");
    return this.resume(rematch.code, created.token);
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
    validateGame(room.game, room.mode);
    return room;
  }
}
