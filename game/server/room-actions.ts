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
  surveyExchange,
} from "../rules/faction-operations";
import { removeCapturedCenter } from "../rules/fleet";
import { selectHiddenLegacy } from "../rules/legacy";
import { resolveSecretOrders, submitSecretOrders } from "../rules/orders";
import { runPendingBotSeats } from "./bot-seats";
import type { RoomCommand, RoomCommandResult } from "./command";
import { RoomService } from "./rooms";
import type { RoomRepository, RoomSession, StoredRoom } from "./types";

export type ExecuteRoomCommandInput = {
  code: string;
  token: string;
  expectedRevision: number;
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
  switch (command.kind) {
    case "selectHidden": {
      const ok = selectHiddenLegacy(game, playerId, command.cardId);
      return ok
        ? { ok: true, message: "Hidden Legacy objective selected." }
        : { ok: false, message: "That Hidden Legacy objective cannot be selected." };
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
  if (room.status === "complete" || room.game.result)
    return { ok: false, message: "That Horizon game is complete." };
  if (room.revision !== input.expectedRevision)
    throw new Error(
      `Room changed from revision ${input.expectedRevision} to ${room.revision}. Sync before acting again.`,
    );

  const playerId = await authenticateHuman(room, input.token);
  const game = structuredClone(room.game);
  const action = executeOnGame(game, playerId, input.command);
  if (!action.ok) return action;

  const botMessages: string[] = [];
  if (
    input.command.kind === "submitOrders" &&
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
  }

  // Re-check just before writing. RoomRepository does not yet provide an atomic
  // compare-and-swap, so this narrows (but cannot entirely eliminate) a race.
  const latest = await repository.get(code);
  if (!latest || latest.revision !== input.expectedRevision)
    throw new Error("The room changed while this command was being processed. Sync and retry.");

  room.game = game;
  room.revision++;
  room.status = game.result ? "complete" : "active";
  room.updatedAt = new Date().toISOString();
  await repository.put(room);

  const session = await new RoomService(repository).resume(code, input.token);
  return {
    ok: true,
    message: action.message,
    session,
    botMessages: botMessages.length ? botMessages : undefined,
  };
}
