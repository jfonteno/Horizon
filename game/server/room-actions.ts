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
} from "../rules/diplomacy";
import { marketExchange } from "../rules/economy";
import {
  brokerTrade,
  economicSalvage,
  negotiationSurvey,
  surveyExchange,
} from "../rules/faction-operations";
import { removeCapturedCenter, transferCombatUnit } from "../rules/fleet";
import {
  drawHiddenChoices,
  manualClaimCivilization,
  manualClaimUniversal,
  selectHiddenLegacy,
  setHiddenCompleted,
} from "../rules/legacy";
import { getBotProfile } from "../../bots";
import { resolveSecretOrders, submitSecretOrders } from "../rules/orders";
import { runPendingBotSeats } from "./bot-seats";
import { validateRoomCommand, type RoomCommand, type RoomCommandResult } from "./command";
import { RoomService } from "./rooms";
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

function proposalId(game: GameState, actorId: number, kind: string) {
  const nonce = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
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
): RoomCommandResult {
  if (game.pendingCenterLoss && command.kind !== "removeCapturedCenter")
    return {
      ok: false,
      message: `${game.players[game.pendingCenterLoss.playerId].name} must finish captured Center losses before further actions.`,
    };
  switch (command.kind) {
    case "setReady":
    case "startGame":
    case "pauseGame":
    case "resumeGame":
    case "endGame":
    case "convertSeatToBot":
      return { ok: false, message: "That command changes the room rather than the game." };
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
        id: proposalId(game, playerId, "trade"),
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
        id: proposalId(game, playerId, "agreement"),
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
        id: proposalId(game, playerId, "technology"),
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

    case "negotiationSurvey":
      return negotiationSurvey(game, playerId, command.hexId);

    case "transferCombatUnit":
      if (
        game.orderProtocol.phase !== "orders" ||
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
  }
}

const roomCommandKinds = new Set([
  "setReady", "startGame", "pauseGame", "resumeGame", "endGame", "convertSeatToBot",
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

async function executeOnRoom(room: StoredRoom, playerId: number, token: string, command: RoomCommand): Promise<RoomCommandResult> {
  const host = (await hashToken(token)) === room.hostTokenHash;
  const seat = room.seats[playerId];
  switch (command.kind) {
    case "setReady":
      if (room.status !== "lobby") return { ok: false, message: "Readiness can only change in the lobby." };
      seat.ready = command.ready;
      return { ok: true, message: `${seat.displayName || room.game.players[playerId].name} is ${command.ready ? "ready" : "not ready"}.` };
    case "startGame": {
      if (!host) return { ok: false, message: "Only the host may start the game." };
      if (room.status !== "lobby") return { ok: false, message: "This room is not waiting in the lobby." };
      const missing = room.seats.filter((candidate) => candidate.controller.kind === "human" && (!candidate.tokenHash || !candidate.ready));
      if (missing.length) return { ok: false, message: `${missing.length} human seat${missing.length === 1 ? " is" : "s are"} not claimed and ready.` };
      room.status = "active";
      return { ok: true, message: "All civilizations are ready. The game has begun." };
    }
    case "pauseGame":
      if (!host) return { ok: false, message: "Only the host may pause the game." };
      if (room.status !== "active") return { ok: false, message: "Only an active game can be paused." };
      room.status = "paused";
      return { ok: true, message: "The host paused the game." };
    case "resumeGame":
      if (!host) return { ok: false, message: "Only the host may resume the game." };
      if (room.status !== "paused") return { ok: false, message: "This game is not paused." };
      room.status = "active";
      return { ok: true, message: "The host resumed the game." };
    case "endGame": {
      if (!host) return { ok: false, message: "Only the host may end the game." };
      if (room.status === "complete") return { ok: false, message: "This game is already complete." };
      const highest = Math.max(...room.game.players.map((player) => player.lp));
      room.game.result = {
        gateSucceeded: room.game.gate >= room.game.players.length * 3,
        winnerIds: room.game.players.filter((player) => player.lp === highest).map((player) => player.id),
        reason: "The host ended the network playtest. Final standings reflect the latest completed state.",
        finalizedTurn: room.game.turn,
      };
      room.status = "complete";
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
      room.game.players[command.playerId].controller = { kind: "bot", profileId: command.profileId };
      return { ok: true, message: `${room.game.players[command.playerId].name} is now controlled by ${target.displayName}.` };
    }
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
    if (!(await repository.compareAndSwap(room, input.expectedRevision)))
      throw new Error("The room changed while this command was being processed. Sync and retry.");
    return { ok: true, message: action.message, session: await new RoomService(repository).resume(code, input.token) };
  }

  if (room.status === "complete" || room.game.result) return { ok: false, message: "That Horizon game is complete." };
  if (room.status === "lobby") return { ok: false, message: "The host must start the game before commands are accepted." };
  if (room.status === "paused") return { ok: false, message: "The host paused this game." };
  const game = structuredClone(room.game);
  const action = executeOnGame(game, playerId, command);
  if (!action.ok) return action;

  const botMessages: string[] = [];
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
  }

  room.game = game;
  room.revision++;
  room.status = game.result ? "complete" : "active";
  room.updatedAt = new Date().toISOString();
  appendRoomEvent(room, playerId, command, action.message);
  room.commandReceipts.push({ commandId, playerId, revision: room.revision, message: action.message });
  room.commandReceipts = room.commandReceipts.slice(-300);
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
