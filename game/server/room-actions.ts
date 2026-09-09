import type {
  AgreementProposal,
  GameState,
  TechnologyProposal,
  TradeProposal,
} from "../types";
import {
  addAgreementProposal,
  addTechnologyProposal,
  addTradeProposal,
  breakAgreement,
  cancelProposal,
  politicalCapital,
  resolveProposal,
  scheduleWithdrawal,
  setStationingPermission,
} from "../rules/diplomacy";
import { marketExchange } from "../rules/economy";
import {
  brokerTrade,
  economicSalvage,
  negotiationSurvey,
  setHomeProductionChoice,
  surveyExchange,
} from "../rules/faction-operations";
import { redistributeCombatUnits, removeCapturedCenter, transferCombatUnit } from "../rules/fleet";
import {
  drawHiddenChoices,
  manualClaimCivilization,
  manualClaimUniversal,
  selectHiddenLegacy,
  setHiddenCompleted,
} from "../rules/legacy";
import { getBotProfile } from "../../bots";
import { createGame } from "../engine/create-game";
import { factionLibrary } from "../factions";
import { beginSecretOrders, resolveSecretOrders, submitSecretOrders } from "../rules/orders";
import { gateTarget } from "../rules/format";
import { runPendingBotSeats } from "./bot-seats";
import { reviewBotDiplomacy } from "../ai/intelligence";
import { validateRoomCommand, type RoomCommand, type RoomCommandResult } from "./command";
import { appendRoomAudit } from "./audit";
import { RoomService } from "./rooms";
import { clearTurnDeadline, pauseTurnDeadline, reconcileExpiredTurnTimer, resumeTurnDeadline, startTurnDeadline } from "./turn-timer";
import type { RoomRepository, RoomSession, StoredRoom } from "./types";

export type ExecuteRoomCommandInput = {
  code: string;
  token: string;
  expectedRevision: number;
  commandId?: string;
  command: RoomCommand;
};

export type ExecuteRoomCommandOptions = {
  runBotsAfterHumanOrders?: boolean;
  autoResolveWhenReady?: boolean;
};

export type ExecuteRoomCommandResult = RoomCommandResult & {
  session?: RoomSession;
  botMessages?: string[];
};

async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function proposalId(game: GameState, actorId: number, kind: string, commandId: string) {
  const nonce = commandId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "command";
  return `net-${kind}-${game.turn}-${actorId}-${nonce}`;
}

async function authenticateHuman(
  room: StoredRoom,
  token: string,
): Promise<number> {
  const tokenHash = await hashToken(token);
  const seat = room.seats.find((candidate) => candidate.tokenHash === tokenHash);
  if (!seat) throw new Error("That room token is not valid.");

  const player = room.game.players[seat.playerId];
  if (!player) throw new Error("That player seat no longer exists.");
  if (player.controller.kind !== "human")
    throw new Error("Bot seats cannot submit remote player commands.");

  return seat.playerId;
}

function assertOtherPlayer(game: GameState, actorId: number, otherId: number) {
  if (!Number.isInteger(otherId) || !game.players[otherId])
    throw new Error("That civilization does not exist.");
  if (actorId === otherId)
    throw new Error("Choose another civilization.");
}

/**
 * Reuses the existing pass-and-play Order validator while permitting remote
 * players to submit in any order. The authenticated player is temporarily made
 * the current private handoff, then submitSecretOrders performs all normal
 * budget, duplicate-vessel, construction, Technology, Tribute, and Hidden
 * Legacy validation.
 */
function submitNetworkOrders(
  game: GameState,
  playerId: number,
  orders: Extract<RoomCommand, { kind: "submitOrders" }>["orders"],
) {
  if (game.orderProtocol.phase !== "orders")
    return { ok: false, message: "The game is not accepting sealed Orders." };
  if (
    game.orderProtocol.submissions.some(
      (submission) => submission.playerId === playerId,
    )
  )
    return { ok: false, message: "This civilization already sealed its Orders." };

  game.orderProtocol.currentPlayer = playerId;
  game.active = playerId;
  return submitSecretOrders(game, playerId, orders);
}

function executeOnGame(
  game: GameState,
  playerId: number,
  command: RoomCommand,
  commandId: string,
): RoomCommandResult {
  if (game.pendingCenterLoss && command.kind !== "removeCapturedCenter")
    return {
      ok: false,
      message: `${game.players[game.pendingCenterLoss.playerId].name} must finish captured Center losses before further actions.`,
    };
  if (game.pendingCombatRedistributions.some((pending) => pending.playerId === playerId) && command.kind !== "redistributeCombatUnits")
    return { ok: false, message: "Complete your post-combat CU redistribution before taking another action." };
  const hidden = game.players[playerId]?.hiddenLegacy[game.era];
  if ((game.turn - 1) % 4 === 0 && !hidden?.selected && !["drawHidden", "selectHidden", "removeCapturedCenter"].includes(command.kind))
    return {
      ok: false,
      message: "Select this Era's Hidden Legacy objective before taking other actions.",
    };
  switch (command.kind) {
    case "setReady":
    case "selectFaction":
    case "startGame":
    case "pauseGame":
    case "resumeGame":
    case "endGame":
    case "convertSeatToBot":
    case "convertSeatToHuman":
    case "resetHumanSeat":
    case "setSeatReady":
    case "postHostNotice":
    case "setTurnTimer":
      return { ok: false, message: "That command changes the room rather than the game." };
    case "beginOrders":
      return beginSecretOrders(game);
    case "drawHidden":
      drawHiddenChoices(game, playerId, game.era);
      return { ok: true, message: "Three private Hidden Legacy objectives drawn." };

    case "selectHidden": {
      const ok = selectHiddenLegacy(game, playerId, command.cardId);
      return ok
        ? { ok: true, message: "Hidden Legacy objective selected." }
        : { ok: false, message: "That Hidden Legacy objective cannot be selected." };
    }

    case "setHiddenCompleted": {
      const ok = setHiddenCompleted(game, playerId, command.completed);
      return ok
        ? { ok: true, message: command.completed ? "Hidden Legacy marked complete." : "Hidden Legacy completion removed." }
        : { ok: false, message: "That Hidden Legacy objective cannot be updated." };
    }

    case "claimUniversal": {
      const ok = manualClaimUniversal(game, playerId, command.objectiveId);
      return ok ? { ok: true, message: "Universal Legacy claimed." } : { ok: false, message: "That Universal Legacy cannot be claimed." };
    }

    case "claimCivilization": {
      const ok = manualClaimCivilization(game, playerId, command.objectiveId);
      return ok ? { ok: true, message: "Civilization Legacy completed." } : { ok: false, message: "That Civilization Legacy cannot be completed." };
    }

    case "submitOrders":
      return submitNetworkOrders(game, playerId, command.orders);

    case "proposeTrade": {
      assertOtherPlayer(game, playerId, command.to);
      const proposal: TradeProposal = {
        id: proposalId(game, playerId, "trade", commandId),
        kind: "trade",
        from: playerId,
        to: command.to,
        offer: structuredClone(command.offer),
        request: structuredClone(command.request),
        createdTurn: game.turn,
        status: "pending",
      };
      return addTradeProposal(game, proposal);
    }

    case "proposeAgreement": {
      assertOtherPlayer(game, playerId, command.to);
      const proposal: AgreementProposal = {
        id: proposalId(game, playerId, "agreement", commandId),
        kind: "agreement",
        from: playerId,
        to: command.to,
        agreementType: command.agreementType,
        createdTurn: game.turn,
        status: "pending",
      };
      return addAgreementProposal(game, proposal);
    }

    case "proposeTechnology": {
      assertOtherPlayer(game, playerId, command.buyer);
      const proposal: TechnologyProposal = {
        id: proposalId(game, playerId, "technology", commandId),
        kind: "technology",
        seller: playerId,
        buyer: command.buyer,
        branch: command.branch,
        level: command.level,
        compensation: structuredClone(command.compensation),
        createdTurn: game.turn,
        status: "pending",
      };
      return addTechnologyProposal(game, proposal);
    }

    case "respondProposal": {
      const proposal = game.proposals.find((candidate) => candidate.id === command.proposalId);
      if (!proposal) return { ok: false, message: "That proposal does not exist." };
      const recipient = proposal.kind === "technology" ? proposal.buyer : proposal.to;
      if (recipient !== playerId)
        return { ok: false, message: "Only the receiving civilization may answer that proposal." };
      return resolveProposal(game, command.proposalId, command.accept);
    }

    case "cancelProposal": {
      const ok = cancelProposal(game, command.proposalId, playerId);
      return ok
        ? { ok: true, message: "Proposal cancelled." }
        : { ok: false, message: "That proposal cannot be cancelled by this civilization." };
    }

    case "withdrawAgreement":
      return scheduleWithdrawal(game, command.agreementId, playerId);

    case "breakAgreement":
      return breakAgreement(game, command.agreementId, playerId);

    case "marketExchange":
      return marketExchange(game, playerId, command.give, command.get);

    case "politicalCapital":
      return politicalCapital(game, playerId, command.output);

    case "economicSalvage":
      return economicSalvage(game, playerId);

    case "setHomeProduction":
      return setHomeProductionChoice(game, playerId, command.resource);

    case "setStationingPermission":
      return setStationingPermission(game, playerId, command.guestId, command.permission, command.allowed);

    case "negotiationSurvey":
      return negotiationSurvey(game, playerId, command.hexId);

    case "transferCombatUnit":
      if (
        !["negotiation", "orders"].includes(game.orderProtocol.phase) ||
        game.orderProtocol.submissions.some((submission) => submission.playerId === playerId)
      )
        return { ok: false, message: "CU transfers must be completed before this civilization seals its Orders." };
      return transferCombatUnit(game, playerId, command.carrierId, command.direction, command.amount);

    case "surveyExchange": {
      assertOtherPlayer(game, playerId, command.buyerId);
      return surveyExchange(
        game,
        playerId,
        command.buyerId,
        command.hexId,
        command.price,
      );
    }

    case "brokerTrade": {
      assertOtherPlayer(game, playerId, command.a);
      assertOtherPlayer(game, playerId, command.b);
      if (command.a === command.b)
        return { ok: false, message: "Brokerage requires two different civilizations." };
      return brokerTrade(
        game,
        playerId,
        command.a,
        command.b,
        structuredClone(command.aGives),
        structuredClone(command.bGives),
      );
    }

    case "removeCapturedCenter":
      return removeCapturedCenter(game, playerId, command.centerIndex);
    case "redistributeCombatUnits":
      return redistributeCombatUnits(game, playerId, command.hexId, command.assignments, command.stationed);
  }
}

const roomCommandKinds = new Set([
  "setReady", "selectFaction", "startGame", "pauseGame", "resumeGame", "endGame", "convertSeatToBot",
  "convertSeatToHuman", "resetHumanSeat", "setSeatReady", "postHostNotice",
  "setTurnTimer",
]);

function isRoomCommand(command: RoomCommand) {
  return roomCommandKinds.has(command.kind);
}

function appendRoomEvent(room: StoredRoom, playerId: number, command: RoomCommand, message: string) {
  const diplomacy = ["proposeTrade", "proposeAgreement", "proposeTechnology", "respondProposal", "cancelProposal", "withdrawAgreement", "breakAgreement", "negotiationSurvey", "surveyExchange", "brokerTrade"].includes(command.kind);
  const publicMessage = diplomacy
    ? command.kind.startsWith("propose")
      ? `${room.game.players[playerId].name} submitted a private diplomatic proposal.`
      : `${room.game.players[playerId].name} updated a private diplomatic matter.`
    : message;
  room.events.push({
    id: `event-${room.revision}-${playerId}-${command.kind}`,
    at: room.updatedAt,
    revision: room.revision,
    type: command.kind === "submitOrders" ? "orders" : diplomacy ? "diplomacy" : isRoomCommand(command) ? "phase" : "system",
    playerId,
    message: publicMessage,
  });
  room.events = room.events.slice(-200);
}

function rebuildLobbyGame(room: StoredRoom) {
  const selected = room.seats.map((seat) => seat.selectedFaction).filter((id): id is string => Boolean(id));
  if (new Set(selected).size !== selected.length)
    throw new Error("Each faction may be selected by only one seat.");
  const remaining = room.availableFactions.filter((id) => !selected.includes(id));
  const factions = room.seats.map((seat) => seat.selectedFaction || remaining.shift());
  if (factions.some((id) => !id || !factionLibrary[id]))
    throw new Error("The room does not have enough installed factions for every seat.");
  room.game = createGame(
    room.seats.length,
    factions as string[],
    room.game.mapId,
    room.game.themeId,
    room.game.seed,
    room.seats.map((seat) => seat.controller),
    room.game.spectatorMode,
    room.game.format,
  );
}

async function executeOnRoom(room: StoredRoom, playerId: number, token: string, command: RoomCommand): Promise<RoomCommandResult> {
  const host = (await hashToken(token)) === room.hostTokenHash;
  const seat = room.seats[playerId];
  switch (command.kind) {
    case "setReady":
      if (room.status !== "lobby") return { ok: false, message: "Readiness can only change in the lobby." };
      if (command.ready && !seat.selectedFaction) return { ok: false, message: "Choose a faction before marking this seat ready." };
      seat.ready = command.ready;
      return { ok: true, message: `${seat.displayName || `Player ${playerId + 1}`} is ${command.ready ? "ready" : "not ready"}.` };
    case "selectFaction": {
      if (room.status !== "lobby") return { ok: false, message: "Factions can only be selected in the lobby." };
      if (seat.controller.kind !== "human") return { ok: false, message: "Bot factions are managed by the host." };
      if (seat.ready) return { ok: false, message: "Mark this seat not ready before changing its faction." };
      if (!room.availableFactions.includes(command.factionId) || !factionLibrary[command.factionId])
        return { ok: false, message: "That faction is not available in this room." };
      const occupant = room.seats.find((candidate) => candidate.playerId !== playerId && candidate.selectedFaction === command.factionId);
      if (occupant) return { ok: false, message: "Another seat has already selected that faction." };
      seat.selectedFaction = command.factionId;
      seat.ready = false;
      rebuildLobbyGame(room);
      return { ok: true, message: `${seat.displayName || `Player ${playerId + 1}`} selected ${factionLibrary[command.factionId].name}.` };
    }
    case "startGame": {
      if (!host) return { ok: false, message: "Only the host may start the game." };
      if (room.status !== "lobby") return { ok: false, message: "This room is not waiting in the lobby." };
      const unselected = room.seats.filter((candidate) => !candidate.selectedFaction);
      if (unselected.length) return { ok: false, message: `${unselected.length} seat${unselected.length === 1 ? " has" : "s have"} not selected a faction.` };
      const missing = room.seats.filter((candidate) => candidate.controller.kind === "human" && (!candidate.tokenHash || !candidate.ready));
      if (missing.length) return { ok: false, message: `${missing.length} human seat${missing.length === 1 ? " is" : "s are"} not claimed and ready.` };
      rebuildLobbyGame(room);
      room.initialGame = structuredClone(room.game);
      room.status = "active";
      startTurnDeadline(room);
      return { ok: true, message: "All civilizations are ready. The game has begun." };
    }
    case "pauseGame":
      if (!host) return { ok: false, message: "Only the host may pause the game." };
      if (room.status !== "active") return { ok: false, message: "Only an active game can be paused." };
      pauseTurnDeadline(room);
      room.status = "paused";
      return { ok: true, message: "The host paused the game." };
    case "resumeGame":
      if (!host) return { ok: false, message: "Only the host may resume the game." };
      if (room.status !== "paused") return { ok: false, message: "This game is not paused." };
      room.status = "active";
      resumeTurnDeadline(room);
      return { ok: true, message: "The host resumed the game." };
    case "endGame": {
      if (!host) return { ok: false, message: "Only the host may end the game." };
      if (room.status === "complete") return { ok: false, message: "This game is already complete." };
      const highest = Math.max(...room.game.players.map((player) => player.lp));
      room.game.result = {
        gateSucceeded: room.game.gate >= gateTarget(room.game),
        winnerIds: room.game.players.filter((player) => player.lp === highest).map((player) => player.id),
        reason: "The host ended the network playtest. Final standings reflect the latest completed state.",
        finalizedTurn: room.game.turn,
      };
      room.status = "complete";
      clearTurnDeadline(room);
      return { ok: true, message: "The host ended and archived the game." };
    }
    case "convertSeatToBot": {
      if (!host) return { ok: false, message: "Only the host may assign a bot takeover." };
      if (room.status !== "lobby" && room.status !== "paused") return { ok: false, message: "Bot takeover requires the lobby or a paused game." };
      if (command.playerId === playerId) return { ok: false, message: "The host seat cannot be converted to a bot." };
      const target = room.seats[command.playerId];
      if (!target) return { ok: false, message: "That seat does not exist." };
      if (!getBotProfile(command.profileId)) return { ok: false, message: "That bot profile is not installed." };
      target.controller = { kind: "bot", profileId: command.profileId };
      target.displayName = getBotProfile(command.profileId)!.name;
      target.tokenHash = null;
      target.ready = true;
      if (room.status === "lobby" && !target.selectedFaction) {
        target.selectedFaction = room.availableFactions.find((id) => !room.seats.some((seat) => seat.playerId !== target.playerId && seat.selectedFaction === id)) || null;
        if (!target.selectedFaction) return { ok: false, message: "No unclaimed faction is available for that bot seat." };
        rebuildLobbyGame(room);
      } else room.game.players[command.playerId].controller = { kind: "bot", profileId: command.profileId };
      return { ok: true, message: `${target.selectedFaction ? factionLibrary[target.selectedFaction]?.name : room.game.players[command.playerId].name} is now controlled by ${target.displayName}.` };
    }
    case "convertSeatToHuman": {
      if (!host) return { ok: false, message: "Only the host may return a seat to human control." };
      if (room.status !== "lobby" && room.status !== "paused") return { ok: false, message: "Seat changes require the lobby or a paused game." };
      if (command.playerId === playerId) return { ok: false, message: "The host seat is already human-controlled." };
      const target = room.seats[command.playerId];
      if (!target) return { ok: false, message: "That seat does not exist." };
      target.controller = { kind: "human" };
      target.displayName = null;
      target.tokenHash = null;
      target.joinedAt = null;
      target.ready = false;
      if (room.status === "lobby") {
        target.selectedFaction = null;
        rebuildLobbyGame(room);
      } else room.game.players[command.playerId].controller = { kind: "human" };
      return { ok: true, message: `Seat ${command.playerId + 1} is open for a human player.` };
    }
    case "resetHumanSeat": {
      if (!host) return { ok: false, message: "Only the host may reopen a human seat." };
      if (room.status !== "lobby" && room.status !== "paused") return { ok: false, message: "Pause the game before reopening a seat." };
      if (command.playerId === playerId) return { ok: false, message: "The active host seat cannot be reopened." };
      const target = room.seats[command.playerId];
      if (!target || target.controller.kind !== "human") return { ok: false, message: "That is not a human seat." };
      target.displayName = null;
      target.tokenHash = null;
      target.joinedAt = null;
      target.ready = false;
      if (room.status === "lobby") {
        target.selectedFaction = null;
        rebuildLobbyGame(room);
      }
      return { ok: true, message: `Seat ${command.playerId + 1} was reopened for a new player.` };
    }
    case "setSeatReady": {
      if (!host) return { ok: false, message: "Only the host may override readiness." };
      if (room.status !== "lobby") return { ok: false, message: "Readiness can only change in the lobby." };
      const target = room.seats[command.playerId];
      if (!target || target.controller.kind !== "human" || !target.tokenHash) return { ok: false, message: "Only a claimed human seat can be marked ready." };
      if (command.ready && !target.selectedFaction) return { ok: false, message: "That player must choose a faction before being marked ready." };
      target.ready = command.ready;
      return { ok: true, message: `${target.displayName || room.game.players[command.playerId].name} was marked ${command.ready ? "ready" : "not ready"} by the host.` };
    }
    case "postHostNotice":
      if (!host) return { ok: false, message: "Only the host may post room notices." };
      return { ok: true, message: `HOST: ${command.message.trim()}` };
    case "setTurnTimer":
      if (!host) return { ok: false, message: "Only the host may configure the Turn timer." };
      if (room.status !== "lobby" && room.status !== "paused") return { ok: false, message: "Pause the game before changing the Turn timer." };
      room.turnTimerSeconds = command.seconds;
      clearTurnDeadline(room);
      return { ok: true, message: command.seconds === null ? "The host disabled the Turn timer." : `The host set the Turn timer to ${Math.round(command.seconds / 60)} minutes.` };
    default:
      return { ok: false, message: "That is not a room lifecycle command." };
  }
}

/**
 * Apply one authenticated network command to the canonical room state.
 *
 * This leaves the existing local/hotseat path untouched. Network mode submits
 * commands to this service; local mode can continue mutating its local GameState
 * exactly as it does today.
 */
export async function executeRoomCommand(
  repository: RoomRepository,
  input: ExecuteRoomCommandInput,
  options: ExecuteRoomCommandOptions = {},
): Promise<ExecuteRoomCommandResult> {
  const code = normalizeCode(input.code);
  await reconcileExpiredTurnTimer(repository, code);
  const room = await repository.get(code);
  if (!room) throw new Error("No Horizon room uses that invitation code.");
  const playerId = await authenticateHuman(room, input.token);
  const command = validateRoomCommand(input.command);
  const commandId = input.commandId?.trim() || `legacy-${crypto.getRandomValues(new Uint32Array(2)).join("-")}`;
  if (commandId.length > 120) throw new Error("commandId must be no more than 120 characters.");
  const receipt = room.commandReceipts.find((candidate) => candidate.commandId === commandId && candidate.playerId === playerId);
  if (receipt) {
    const session = await new RoomService(repository).resume(code, input.token);
    return { ok: true, message: receipt.message, session };
  }
  if (room.revision !== input.expectedRevision)
    throw new Error(`Room changed from revision ${input.expectedRevision} to ${room.revision}. Sync before acting again.`);

  if (isRoomCommand(command)) {
    const action = await executeOnRoom(room, playerId, input.token, command);
    if (!action.ok) return action;
    room.revision++;
    room.updatedAt = new Date().toISOString();
    appendRoomEvent(room, playerId, command, action.message);
    room.commandReceipts.push({ commandId, playerId, revision: room.revision, message: action.message });
    room.commandReceipts = room.commandReceipts.slice(-300);
    await appendRoomAudit(room, playerId, commandId, command);
    if (!(await repository.compareAndSwap(room, input.expectedRevision)))
      throw new Error("The room changed while this command was being processed. Sync and retry.");
    return { ok: true, message: action.message, session: await new RoomService(repository).resume(code, input.token) };
  }

  if (room.status === "complete" || room.game.result) return { ok: false, message: "That Horizon game is complete." };
  if (room.status === "lobby") return { ok: false, message: "The host must start the game before commands are accepted." };
  if (room.status === "paused") return { ok: false, message: "The host paused this game." };
  const previousTurn = room.game.turn;
  const game = structuredClone(room.game);
  const action = executeOnGame(game, playerId, command, commandId);
  if (!action.ok) return action;

  const botMessages: string[] = [];
  if (["proposeTrade", "proposeAgreement", "proposeTechnology"].includes(command.kind)) {
    const recipient = command.kind === "proposeTechnology" ? command.buyer : command.kind === "proposeTrade" || command.kind === "proposeAgreement" ? command.to : -1;
    if (game.players[recipient]?.controller.kind === "bot") {
      const review = reviewBotDiplomacy(game, recipient);
      botMessages.push(...review.messages.map((entry) => `${game.players[recipient].name}: ${entry}`));
    }
  }
  if (
    command.kind === "submitOrders" &&
    options.runBotsAfterHumanOrders !== false &&
    game.orderProtocol.phase === "orders"
  ) {
    const bots = runPendingBotSeats(game);
    botMessages.push(...bots.messages);
  }

  if (
    options.autoResolveWhenReady !== false &&
    game.orderProtocol.phase === "ready"
  ) {
    const resolution = resolveSecretOrders(game);
    if (!resolution.ok)
      throw new Error(`Automatic Turn resolution failed: ${resolution.message}`);
    while (
      game.pendingCenterLoss &&
      game.players[game.pendingCenterLoss.playerId].controller.kind === "bot"
    ) {
      const result = removeCapturedCenter(game, game.pendingCenterLoss.playerId, 0);
      if (!result.ok) throw new Error(`Bot capture bookkeeping failed: ${result.message}`);
    }
    for (const pending of [...game.pendingCombatRedistributions]) {
      if (game.players[pending.playerId].controller.kind !== "bot") continue;
      const assignments = pending.carrierIds.map((carrierId) => ({ carrierId, cu: game.carriers.find((carrier) => carrier.id === carrierId)?.cu || 1 }));
      const allocated = assignments.reduce((sum, assignment) => sum + assignment.cu, 0);
      redistributeCombatUnits(game, pending.playerId, pending.hexId, assignments, pending.allowStationed ? pending.total - allocated : 0);
    }
  }

  room.game = game;
  if (game.result) clearTurnDeadline(room);
  else if (!game.pendingCenterLoss && (game.turn !== previousTurn || !room.turnDeadlineAt)) startTurnDeadline(room);
  room.revision++;
  room.status = game.result ? "complete" : "active";
  room.updatedAt = new Date().toISOString();
  appendRoomEvent(room, playerId, command, action.message);
  room.commandReceipts.push({ commandId, playerId, revision: room.revision, message: action.message });
  room.commandReceipts = room.commandReceipts.slice(-300);
  await appendRoomAudit(room, playerId, commandId, command);
  if (!(await repository.compareAndSwap(room, input.expectedRevision)))
    throw new Error("The room changed while this command was being processed. Sync and retry.");

  const session = await new RoomService(repository).resume(code, input.token);
  return {
    ok: true,
    message: action.message,
    session,
    botMessages: botMessages.length ? botMessages : undefined,
  };
}
