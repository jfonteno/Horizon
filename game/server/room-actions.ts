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
  counterTradeProposal,
  emptyTradeBundle,
  politicalCapital,
  resolveProposal,
  scheduleWithdrawal,
  setStationingPermission,
} from "../rules/diplomacy";
import { marketExchange } from "../rules/economy";
import { botBrokerageDecision, proposeBrokerage, respondBrokerage } from "../rules/brokerage-offers";
import {
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
import { advanceTutorial, firstHorizonLessons, syncTutorial } from "../tutorial";
import { advanceAcademy, recordAcademyCommand, recordAcademyPanel, restartAcademyStage, syncAcademy } from "../academy";
import { gateTarget } from "../rules/format";
import { projectedOrderBudget } from "../rules/purchases";
import { sealPolicyVote } from "../rules/policy-deck";
import { runPendingBotSeats } from "./bot-seats";
import { reviewBotDiplomacy } from "../ai/intelligence";
import { validateRoomCommand, type RoomCommand, type RoomCommandResult } from "./command";
import { appendRoomAudit } from "./audit";
import { RoomService } from "./rooms";
import { clearTurnDeadline, pauseTurnDeadline, reconcileExpiredTurnTimer, resumeTurnDeadline, startTurnDeadline } from "./turn-timer";
import type { RoomFeedback, RoomRepository, RoomSession, StoredRoom } from "./types";
import { appendBotDiplomacyChat, appendDiplomacyChat, appendSystemChat, executeChatCommand } from "./chat";

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
  if (room.mode === "local" && tokenHash === room.hostTokenHash) return room.game.active;
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
  if (!["negotiation", "orders"].includes(game.orderProtocol.phase))
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
  if ((game.turn - 1) % 4 === 0 && !hidden?.selected && !["beginOrders", "drawHidden", "selectHidden", "removeCapturedCenter", "redistributeCombatUnits", "advanceTutorial", "dismissTutorial", "tutorialEvent", "advanceAcademy", "restartAcademyStage", "dismissAcademy", "academyEvent"].includes(command.kind))
    return {
      ok: false,
      message: "Select this Era's Hidden Legacy objective before taking other actions.",
    };
  switch (command.kind) {
    case "setReady":
    case "selectFaction":
    case "setBotFaction":
    case "startGame":
    case "pauseGame":
    case "resumeGame":
    case "endGame":
    case "submitFeedback":
    case "convertSeatToBot":
    case "setBotDifficulty":
    case "convertSeatToHuman":
    case "resetHumanSeat":
    case "setSeatReady":
    case "postHostNotice":
    case "setTurnTimer":
    case "setAutoStart":
    case "setRoomName":
    case "transferHost":
    case "createChat":
    case "sendChat":
    case "markChatRead":
    case "setChatMuted":
    case "setPlayerBlocked":
    case "reportChatMessage":
    case "setGatePledge":
    case "reviewChatReport":
      return { ok: false, message: "That command changes the room rather than the game." };
    case "beginOrders":
      return game.orderProtocol.phase === "negotiation" ? beginSecretOrders(game) : { ok: false, message: "Orders are already open." };
    case "unsealOrders": {
      if (!["negotiation", "orders", "ready"].includes(game.orderProtocol.phase))
        return { ok: false, message: "This Turn has already resolved." };
      const index = game.orderProtocol.submissions.findIndex((entry) => entry.playerId === playerId && entry.turn === game.turn);
      if (index < 0) return { ok: false, message: "You have no sealed Orders this Turn." };
      game.orderProtocol.submissions.splice(index, 1);
      game.orderProtocol.phase = "orders";
      game.orderProtocol.currentPlayer = playerId;
      return { ok: true, message: "Orders reopened. Edit your plan and seal it again before the Turn resolves." };
    }
    case "drawHidden":
      drawHiddenChoices(game, playerId, game.era);
      return { ok: true, message: "Three private Hidden Legacy objectives drawn." };

    case "selectHidden": {
      const ok = selectHiddenLegacy(game, playerId, command.cardId);
      return ok
        ? { ok: true, message: "Hidden Legacy objective selected." }
        : { ok: false, message: "That Hidden Legacy objective cannot be selected." };
    }

    case "sealPolicyVote":
      return sealPolicyVote(game, playerId, command.policyId, command.influence);

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
    case "saveDraft":
      return { ok: false, message: "Private drafts are stored on the room rather than resolved as game actions." };
    case "advanceTutorial":
      if (game.scenarioId !== "first-horizon" || !game.tutorial) return { ok: false, message: "This room is not running First Horizon." };
      advanceTutorial(game, true);
      return { ok: true, message: "First Horizon lesson advanced." };
    case "dismissTutorial":
      if (game.scenarioId !== "first-horizon" || !game.tutorial) return { ok: false, message: "This room is not running First Horizon." };
      game.tutorial.dismissed = true;
      return { ok: true, message: "First Horizon guidance hidden. Every command remains available." };
    case "tutorialEvent": {
      if (game.scenarioId !== "first-horizon" || !game.tutorial) return { ok: false, message: "This room is not running First Horizon." };
      if (command.event === "panel-opened") {
        game.tutorial.seenPanels ||= [];
        if (!game.tutorial.seenPanels.includes(command.value)) game.tutorial.seenPanels.push(command.value);
        return { ok: true, message: `${command.value} interface explored.` };
      }
      const hex = game.hexes.find((candidate) => candidate.id === command.value);
      const home = game.hexes.find((candidate) => candidate.kind === "home" && candidate.originalOwner === playerId)?.id;
      if (!hex || hex.id === home) return { ok: false, message: "Inspect a sector away from your Homeworld." };
      if (firstHorizonLessons[game.tutorial.step]?.id === "inspect") game.selected = hex.id;
      return { ok: true, message: `Sector ${hex.id} inspected.` };
    }
    case "advanceAcademy":
      return advanceAcademy(game)
        ? { ok: true, message: game.academy?.completed ? "Academy completed. Free practice is active." : "The next Academy exercise is ready." }
        : { ok: false, message: "This room is not running a faction Academy scenario." };
    case "restartAcademyStage":
      return restartAcademyStage(game)
        ? { ok: true, message: "Academy exercise restarted from its prepared position." }
        : { ok: false, message: "This room is not running a faction Academy scenario." };
    case "dismissAcademy":
      if (game.scenarioId !== "faction-academy" || !game.academy) return { ok: false, message: "This room is not running a faction Academy scenario." };
      game.academy.dismissed = true;
      return { ok: true, message: "Academy guidance hidden. Use Show Academy Guide to restore it at any time." };
    case "showAcademy":
      if (game.scenarioId !== "faction-academy" || !game.academy) return { ok: false, message: "This room is not running a faction Academy scenario." };
      game.academy.dismissed = false;
      return { ok: true, message: "Academy guidance restored." };
    case "academyEvent":
      if (game.scenarioId !== "faction-academy" || !game.academy) return { ok: false, message: "This room is not running a faction Academy scenario." };
      recordAcademyPanel(game, command.value);
      syncAcademy(game);
      return { ok: true, message: `${command.value} Academy panel explored.` };

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

    case "proposeBlockadeSale": {
      assertOtherPlayer(game, playerId, command.buyer);
      const proposal: TradeProposal = {
        id: proposalId(game, playerId, "blockade", commandId),
        kind: "trade",
        from: playerId,
        to: command.buyer,
        offer: emptyTradeBundle(),
        request: structuredClone(command.price),
        blockadeId: command.blockadeId,
        createdTurn: game.turn,
        status: "pending",
      };
      return addTradeProposal(game, proposal);
    }

    case "proposeBlockadeCommission": {
      assertOtherPlayer(game, playerId, command.buyer);
      const proposal: TradeProposal = {
        id: proposalId(game, playerId, "blockade-commission", commandId),
        kind: "trade", from: playerId, to: command.buyer,
        offer: emptyTradeBundle(), request: { ...emptyTradeBundle(), ...command.fee },
        blockadeCommission: true, createdTurn: game.turn, status: "pending",
      };
      return addTradeProposal(game, proposal);
    }

    case "counterTrade": {
      return counterTradeProposal(game, playerId, command.proposalId, proposalId(game, playerId, "counter", commandId), command.offer, command.request);
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
      return resolveProposal(game, command.proposalId, command.accept, command.blockadeDestinationHexId);
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
      return proposeBrokerage(
        game,
        playerId,
        command.a,
        command.b,
        structuredClone(command.aGives),
        structuredClone(command.bGives),
        proposalId(game, playerId, "brokerage", commandId),
      );
    }

    case "respondBrokerage":
      return respondBrokerage(game, command.offerId, playerId, command.accept);

    case "cancelBrokerage": {
      const offer = game.brokerageOffers.find((candidate) => candidate.id === command.offerId);
      if (!offer || offer.meridianId !== playerId || offer.status !== "pending")
        return { ok: false, message: "Only the broker may withdraw a pending offer." };
      offer.status = "cancelled";
      return { ok: true, message: "Brokerage offer withdrawn." };
    }

    case "removeCapturedCenter":
      return removeCapturedCenter(game, playerId, command.centerIndex);
    case "redistributeCombatUnits":
      return redistributeCombatUnits(game, playerId, command.hexId, command.assignments, command.stationed);
  }
}

const roomCommandKinds = new Set([
  "setReady", "selectFaction", "setBotFaction", "startGame", "pauseGame", "resumeGame", "endGame", "submitFeedback", "convertSeatToBot", "setBotDifficulty",
  "convertSeatToHuman", "resetHumanSeat", "setSeatReady", "postHostNotice",
  "setTurnTimer", "setAutoStart", "setRoomName", "transferHost", "saveDraft", "createChat", "sendChat", "markChatRead", "setChatMuted", "setPlayerBlocked", "reportChatMessage", "setGatePledge", "reviewChatReport",
]);

function isRoomCommand(command: RoomCommand) {
  return roomCommandKinds.has(command.kind);
}

function isPrivateCommunication(command: RoomCommand) {
  return ["createChat", "sendChat", "markChatRead", "setChatMuted", "setPlayerBlocked", "reportChatMessage", "reviewChatReport", "submitFeedback"].includes(command.kind);
}

function auditSafeCommand(command: RoomCommand): unknown {
  if (command.kind === "sealPolicyVote") return { kind: command.kind, choice: "[sealed until resolution]" };
  if (command.kind === "sendChat") return { ...command, text: `[private message: ${command.text.trim().length} characters]` };
  if (command.kind === "reportChatMessage") return { ...command, reason: "[private moderation report]" };
  if (command.kind === "submitFeedback") return { kind: command.kind, rating: command.rating, difficulty: command.difficulty, wouldPlayAgain: command.wouldPlayAgain, issueTags: command.issueTags, note: `[private playtest note: ${command.note.trim().length} characters]` };
  return command;
}

function proposalParties(proposal: GameState["proposals"][number]) {
  return proposal.kind === "technology" ? [proposal.seller, proposal.buyer] as const : [proposal.from, proposal.to] as const;
}

function proposalChatText(proposal: GameState["proposals"][number]) {
  if (proposal.kind === "trade") return proposal.blockadeCommission ? "Sent an Aegis Blockade commission offer." : proposal.blockadeId ? "Sent an Aegis Blockade sale offer." : proposal.counterOf ? "Sent a revised trade counteroffer." : "Sent a direct trade proposal.";
  if (proposal.kind === "technology") return "Sent a Technology Exchange proposal.";
  return "Sent a formal agreement proposal.";
}

function appendRoomEvent(room: StoredRoom, playerId: number, command: RoomCommand, message: string) {
  const diplomacy = ["proposeTrade", "proposeBlockadeSale", "proposeBlockadeCommission", "counterTrade", "proposeAgreement", "proposeTechnology", "respondProposal", "cancelProposal", "withdrawAgreement", "breakAgreement", "negotiationSurvey", "surveyExchange", "brokerTrade", "respondBrokerage", "cancelBrokerage"].includes(command.kind);
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
  appendSystemChat(room, publicMessage);
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

function lockRandomBotFactions(room: StoredRoom) {
  const claimed = new Set(room.seats.map((seat) => seat.selectedFaction).filter((id): id is string => Boolean(id)));
  const remaining = room.availableFactions.filter((id) => !claimed.has(id));
  for (const seat of room.seats.filter((candidate) => candidate.controller.kind === "bot" && candidate.randomFaction)) {
    if (!remaining.length) throw new Error("The room does not have enough available factions for every random bot.");
    const index = Math.abs((room.game.seed + seat.playerId * 31) % remaining.length);
    seat.selectedFaction = remaining.splice(index, 1)[0];
    seat.randomFaction = false;
  }
}

function lobbyLaunchError(room: StoredRoom) {
  const unselected = room.seats.filter((candidate) => !candidate.selectedFaction && !(candidate.controller.kind === "bot" && candidate.randomFaction));
  if (unselected.length) return `${unselected.length} seat${unselected.length === 1 ? " has" : "s have"} not selected a faction.`;
  const missing = room.seats.filter((candidate) => candidate.controller.kind === "human" && (!candidate.tokenHash || !candidate.ready));
  if (missing.length) return `${missing.length} human seat${missing.length === 1 ? " is" : "s are"} not claimed and ready.`;
  return null;
}

function launchLobby(room: StoredRoom) {
  lockRandomBotFactions(room);
  rebuildLobbyGame(room);
  room.initialGame = structuredClone(room.game);
  room.status = "active";
  startTurnDeadline(room);
}

function finishLobbyMutation(room: StoredRoom, result: RoomCommandResult): RoomCommandResult {
  if (!result.ok || room.status !== "lobby" || !room.autoStartWhenReady || lobbyLaunchError(room)) return result;
  launchLobby(room);
  return { ok: true, message: `${result.message} All civilizations are ready, so the game began automatically.` };
}

function syncBotGatePledges(room: StoredRoom) {
  for (const player of room.game.players.filter((candidate) => candidate.controller.kind === "bot")) {
    const delivered = player.eraTributes[room.game.era - 1] || 0;
    const planned = room.game.orderProtocol.submissions.find((submission) => submission.playerId === player.id)?.orders.filter((order) => order.kind === "tribute").length || 0;
    const amount = delivered + planned;
    room.gatePledges = room.gatePledges.filter((pledge) => !(pledge.playerId === player.id && pledge.era === room.game.era));
    if (amount) room.gatePledges.push({ playerId: player.id, era: room.game.era, amount, updatedAt: room.updatedAt, source: "bot" });
  }
}

async function executeOnRoom(room: StoredRoom, playerId: number, token: string, command: RoomCommand): Promise<RoomCommandResult> {
  const host = (await hashToken(token)) === room.hostTokenHash;
  const seat = room.seats[playerId];
  switch (command.kind) {
    case "createChat":
    case "sendChat":
    case "markChatRead":
    case "setChatMuted":
    case "setPlayerBlocked":
    case "reportChatMessage":
      return executeChatCommand(room, playerId, command);
    case "setGatePledge": {
      if (room.status === "complete") return { ok: false, message: "The completed Gate ledger is read-only." };
      const delivered = room.game.players[playerId].eraTributes[room.game.era - 1] || 0;
      if (command.amount < delivered) return { ok: false, message: `Your pledge cannot be below the ${delivered} Tribute${delivered === 1 ? "" : "s"} already contributed this Era.` };
      room.gatePledges = room.gatePledges.filter((pledge) => !(pledge.playerId === playerId && pledge.era === room.game.era));
      if (command.amount) room.gatePledges.push({ playerId, era: room.game.era, amount: command.amount, updatedAt: new Date().toISOString(), source: "player" });
      return { ok: true, message: command.amount ? `${room.game.players[playerId].name} publicly pledged ${command.amount} Gate Tribute${command.amount === 1 ? "" : "s"} for Era ${room.game.era}.` : `${room.game.players[playerId].name} cleared their Gate pledge.` };
    }
    case "reviewChatReport": {
      if (!host) return { ok: false, message: "Only the room host may review match-chat reports." };
      const report = room.chat.reports.find((candidate) => candidate.id === command.reportId && candidate.status === "open");
      if (!report) return { ok: false, message: "That chat report is no longer open." };
      if (command.action === "remove") {
        const reported = room.chat.messages.find((candidate) => candidate.id === report.messageId);
        if (reported) {
          reported.text = "Message removed by room moderation.";
          reported.senderId = undefined;
          reported.senderKind = "system";
          reported.attachment = undefined;
        }
      }
      report.status = "reviewed";
      return { ok: true, message: command.action === "remove" ? "Reported message removed." : "Chat report dismissed." };
    }
    case "setReady":
      if (room.status !== "lobby") return { ok: false, message: "Readiness can only change in the lobby." };
      if (command.ready && !seat.selectedFaction) return { ok: false, message: "Choose a faction before marking this seat ready." };
      seat.ready = command.ready;
      return finishLobbyMutation(room, { ok: true, message: `${seat.displayName || `Player ${playerId + 1}`} is ${command.ready ? "ready" : "not ready"}.` });
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
    case "setBotFaction": {
      if (!host) return { ok: false, message: "Only the host may configure bot factions." };
      if (room.status !== "lobby") return { ok: false, message: "Bot factions can only be configured in the lobby." };
      const target = room.seats[command.playerId];
      if (!target || target.controller.kind !== "bot") return { ok: false, message: "That seat is not controlled by a bot." };
      if (command.random) {
        target.selectedFaction = null;
        target.randomFaction = true;
        rebuildLobbyGame(room);
        return finishLobbyMutation(room, { ok: true, message: `Seat ${target.playerId + 1} will receive a random available faction when the game starts.` });
      }
      if (!command.factionId || !room.availableFactions.includes(command.factionId) || !factionLibrary[command.factionId])
        return { ok: false, message: "That faction is not available in this room." };
      if (room.seats.some((candidate) => candidate.playerId !== target.playerId && candidate.selectedFaction === command.factionId))
        return { ok: false, message: "Another seat has already selected that faction." };
      target.selectedFaction = command.factionId;
      target.randomFaction = false;
      rebuildLobbyGame(room);
      return finishLobbyMutation(room, { ok: true, message: `The host assigned ${factionLibrary[command.factionId].name} to bot seat ${target.playerId + 1}.` });
    }
    case "startGame": {
      if (!host) return { ok: false, message: "Only the host may start the game." };
      if (room.status !== "lobby") return { ok: false, message: "This room is not waiting in the lobby." };
      const launchError = lobbyLaunchError(room);
      if (launchError) return { ok: false, message: launchError };
      launchLobby(room);
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
    case "submitFeedback": {
      if (room.status !== "complete" || !room.game.result)
        return { ok: false, message: "Playtest feedback opens after the game is complete." };
      const allowed = new Set<RoomFeedback["issueTags"][number]>(["rules", "interface", "balance", "performance", "connection", "accessibility"]);
      const entry: RoomFeedback = {
        playerId,
        rating: command.rating,
        difficulty: command.difficulty,
        wouldPlayAgain: command.wouldPlayAgain,
        issueTags: [...new Set(command.issueTags.filter((tag): tag is RoomFeedback["issueTags"][number] => allowed.has(tag as RoomFeedback["issueTags"][number])))],
        note: command.note.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 1000),
        submittedAt: new Date().toISOString(),
      };
      room.feedback = room.feedback.filter((feedback) => feedback.playerId !== playerId);
      room.feedback.push(entry);
      return { ok: true, message: "Private playtest feedback saved. You can revise it until the room is archived externally." };
    }
    case "convertSeatToBot": {
      if (!host) return { ok: false, message: "Only the host may assign a bot takeover." };
      if (room.status !== "lobby" && room.status !== "paused") return { ok: false, message: "Bot takeover requires the lobby or a paused game." };
      if (command.playerId === playerId) return { ok: false, message: "The host seat cannot be converted to a bot." };
      const target = room.seats[command.playerId];
      if (!target) return { ok: false, message: "That seat does not exist." };
      if (!getBotProfile(command.profileId)) return { ok: false, message: "That bot profile is not installed." };
      target.controller = { kind: "bot", profileId: command.profileId };
      target.accountId = null;
      target.displayName = getBotProfile(command.profileId)!.name;
      target.tokenHash = null;
      target.ready = true;
      if (room.status === "lobby" && !target.selectedFaction) {
        target.randomFaction = true;
        rebuildLobbyGame(room);
      } else room.game.players[command.playerId].controller = { kind: "bot", profileId: command.profileId };
      return finishLobbyMutation(room, { ok: true, message: `${target.selectedFaction ? factionLibrary[target.selectedFaction]?.name : room.game.players[command.playerId].name} is now controlled by ${target.displayName}.` });
    }
    case "setBotDifficulty": {
      if (!host) return { ok: false, message: "Only the host may set bot difficulty." };
      if (room.status !== "lobby" && room.status !== "paused") return { ok: false, message: "Pause the game to change bot difficulty." };
      const target = room.seats[command.playerId];
      if (!target || target.controller.kind !== "bot") return { ok: false, message: "Choose a bot seat." };
      if (!["ai-easy", "ai-medium", "ai-hard", "ai-emperor"].includes(command.profileId)) return { ok: false, message: "Choose Easy, Medium, Hard, or Emperor." };
      const profile = getBotProfile(command.profileId)!;
      target.controller = { kind: "bot", profileId: profile.id };
      target.displayName = `${profile.name} AI`;
      room.game.players[command.playerId].controller = { kind: "bot", profileId: profile.id };
      return finishLobbyMutation(room, { ok: true, message: `Seat ${command.playerId + 1} is now ${profile.name}.` });
    }
    case "convertSeatToHuman": {
      if (!host) return { ok: false, message: "Only the host may return a seat to human control." };
      if (room.status !== "lobby" && room.status !== "paused") return { ok: false, message: "Seat changes require the lobby or a paused game." };
      if (command.playerId === playerId) return { ok: false, message: "The host seat is already human-controlled." };
      const target = room.seats[command.playerId];
      if (!target) return { ok: false, message: "That seat does not exist." };
      target.controller = { kind: "human" };
      target.accountId = null;
      target.displayName = null;
      target.tokenHash = null;
      target.joinedAt = null;
      target.ready = false;
      if (room.status === "lobby") {
        target.selectedFaction = null;
        target.randomFaction = false;
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
      target.accountId = null;
      target.tokenHash = null;
      target.joinedAt = null;
      target.ready = false;
      if (room.status === "lobby") {
        target.selectedFaction = null;
        target.randomFaction = false;
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
      return finishLobbyMutation(room, { ok: true, message: `${target.displayName || room.game.players[command.playerId].name} was marked ${command.ready ? "ready" : "not ready"} by the host.` });
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
    case "setAutoStart":
      if (!host) return { ok: false, message: "Only the host may configure automatic launch." };
      if (room.status !== "lobby") return { ok: false, message: "Automatic launch can only be changed in the lobby." };
      room.autoStartWhenReady = command.enabled;
      return finishLobbyMutation(room, { ok: true, message: command.enabled ? "The host enabled automatic launch when every human seat is ready." : "The host disabled automatic launch." });
    case "setRoomName":
      if (!host) return { ok: false, message: "Only the host may rename the room." };
      room.name = command.name.trim() || room.code;
      return { ok: true, message: `Room renamed to ${room.name}.` };
    case "transferHost": {
      if (!host) return { ok: false, message: "Only the current host may transfer host authority." };
      if (command.playerId === playerId) return { ok: false, message: "You already control the host seat." };
      const target = room.seats[command.playerId];
      if (!target || target.controller.kind !== "human" || !target.tokenHash)
        return { ok: false, message: "Host authority can only transfer to a claimed human seat." };
      room.hostTokenHash = target.tokenHash;
      room.hostAccountId = target.accountId || null;
      return { ok: true, message: `Host authority transferred to ${target.displayName || `seat ${target.playerId + 1}`}.` };
    }
    case "saveDraft": {
      if (room.status !== "active") return { ok: false, message: "Private drafts can be saved only during an active game." };
      if (room.game.orderProtocol.submissions.some((submission) => submission.playerId === playerId)) return { ok: false, message: "Unseal Orders before replacing the private draft." };
      room.drafts = room.drafts.filter((draft) => !(draft.playerId === playerId && draft.turn === room.game.turn));
      room.drafts.push({ playerId, turn: room.game.turn, orders: structuredClone(command.orders), updatedAt: new Date().toISOString() });
      return { ok: true, message: "Private Order draft synchronized." };
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
  await reconcileExpiredTurnTimer(repository, code);
  const room = await repository.get(code);
  if (!room) throw new Error("No Horizon room uses that invitation code.");
  const authenticatedPlayerId = await authenticateHuman(room, input.token);
  const playerId = room.mode === "local" ? room.game.active : authenticatedPlayerId;
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
    if (command.kind !== "saveDraft" && !isPrivateCommunication(command)) appendRoomEvent(room, playerId, command, action.message);
    room.commandReceipts.push({ commandId, playerId, revision: room.revision, message: action.message });
    room.commandReceipts = room.commandReceipts.slice(-300);
    await appendRoomAudit(room, playerId, commandId, auditSafeCommand(command) as RoomCommand);
    if (!(await repository.compareAndSwap(room, input.expectedRevision)))
      throw new Error("The room changed while this command was being processed. Sync and retry.");
    return { ok: true, message: action.message, session: await new RoomService(repository).resume(code, input.token) };
  }

  if (room.status === "complete" || room.game.result) return { ok: false, message: "That Horizon game is complete." };
  if (room.status === "lobby") return { ok: false, message: "The host must start the game before commands are accepted." };
  if (room.status === "paused") return { ok: false, message: "The host paused this game." };
  if (command.kind === "submitOrders" && room.game.scenarioId !== "first-horizon" && room.seats[playerId]?.controller.kind === "human" &&
      (room.game.turn - 1) % 4 === 0 && room.game.policyElection?.choices.length &&
      !room.game.policyElection.votingClosed &&
      !room.game.policyElection.votes.some((vote) => vote.playerId === playerId))
    return { ok: false, message: "Seal your Policy ballot, including an abstention if you wish, before sealing Orders." };
  const previousTurn = room.game.turn;
  const previousProposalIds = new Set(room.game.proposals.map((proposal) => proposal.id));
  const previousBrokerageIds = new Set((room.game.brokerageOffers || []).map((offer) => offer.id));
  const game = structuredClone(room.game);
  const protectedDrafts = room.drafts.filter((draft) => draft.turn === game.turn &&
    !game.orderProtocol.submissions.some((submission) => submission.playerId === draft.playerId) &&
    !projectedOrderBudget(game, draft.playerId, draft.orders).error);
  game.brokerageOffers ||= [];
  const action = executeOnGame(game, playerId, command, commandId);
  if (!action.ok) return action;
  if (!["advanceAcademy", "restartAcademyStage", "dismissAcademy", "showAcademy", "academyEvent"].includes(command.kind)) recordAcademyCommand(game, command);
  syncTutorial(game);
  syncAcademy(game);

  const botMessages: string[] = [];
  const botChat: Array<{ botId: number; messages: string[] }> = [];
  if (command.kind === "brokerTrade" || command.kind === "respondBrokerage") {
    const offer = command.kind === "brokerTrade"
      ? game.brokerageOffers.find((candidate) => !previousBrokerageIds.has(candidate.id))
      : game.brokerageOffers.find((candidate) => candidate.id === command.offerId);
    if (offer?.status === "pending") for (const botId of [offer.a, offer.b]) {
      if (game.players[botId].controller.kind !== "bot" || offer.approvedBy.includes(botId) || offer.status !== "pending") continue;
      const accepts = botBrokerageDecision(game, offer, botId);
      const response = respondBrokerage(game, offer.id, botId, accepts);
      botMessages.push(`${game.players[botId].name}: ${response.message}`);
    }
  }
  if (["proposeTrade", "proposeBlockadeSale", "proposeBlockadeCommission", "counterTrade", "proposeAgreement", "proposeTechnology"].includes(command.kind)) {
    const submitted = [...game.proposals].reverse().find((proposal) => !previousProposalIds.has(proposal.id) && proposal.status === "pending" && proposalParties(proposal)[0] === playerId);
    const recipient = submitted ? proposalParties(submitted)[1] : -1;
    if (game.players[recipient]?.controller.kind === "bot") {
      const review = reviewBotDiplomacy(game, recipient);
      botMessages.push(...review.messages.map((entry) => `${game.players[recipient].name}: ${entry}`));
      botChat.push({ botId: recipient, messages: review.messages });
    }
  }
  // Bot acceptances can occur while the offer is created, so check after their
  // response as well as after a human acceptance. Never commit a transaction
  // that spends a resource already reserved by a valid private draft.
  if (protectedDrafts.some((draft) => projectedOrderBudget(game, draft.playerId, draft.orders).error))
    return { ok: false, message: "This transaction would consume resources committed to drafted Orders. Revise the trade or remove those Orders first." };
  if (
    command.kind === "submitOrders" &&
    options.runBotsAfterHumanOrders !== false &&
    game.orderProtocol.phase === "orders"
  ) {
    const bots = runPendingBotSeats(game);
    botMessages.push(...bots.messages);
  }
  if (room.mode === "local" && game.spectatorMode && game.orderProtocol.phase === "orders") {
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
    syncTutorial(game);
    syncAcademy(game);
  }

  room.game = game;
  syncBotGatePledges(room);
  for (const offer of game.brokerageOffers.filter((candidate) => !previousBrokerageIds.has(candidate.id))) {
    for (const participant of [offer.a, offer.b])
      appendDiplomacyChat(room, offer.meridianId, participant, offer.id,
        `Proposed a brokered exchange. ${offer.status === "pending" ? "Your approval is required." : "The offer has been answered."}`);
  }
  if (command.kind === "respondBrokerage" || command.kind === "cancelBrokerage") {
    const offer = game.brokerageOffers.find((candidate) => candidate.id === command.offerId);
    if (offer) for (const participant of [offer.meridianId, offer.a, offer.b].filter((id) => id !== playerId))
      appendDiplomacyChat(room, playerId, participant, offer.id, action.message);
  }
  const newProposals = game.proposals.filter((proposal) => !previousProposalIds.has(proposal.id));
  for (const proposal of newProposals) {
    const [from, to] = proposalParties(proposal);
    appendDiplomacyChat(room, from, to, proposal.id, proposalChatText(proposal));
  }
  for (const entry of botChat) appendBotDiplomacyChat(room, entry.botId, playerId, entry.messages);
  if (command.kind === "respondProposal" || command.kind === "cancelProposal") {
    const proposal = game.proposals.find((candidate) => candidate.id === command.proposalId);
    if (proposal) {
      const [from, to] = proposalParties(proposal);
      appendDiplomacyChat(room, playerId, from === playerId ? to : from, proposal.id, action.message);
    }
  }
  if (command.kind === "submitOrders") room.drafts = room.drafts.filter((draft) => !(draft.playerId === playerId && draft.turn === previousTurn));
  if (game.result) clearTurnDeadline(room);
  else if (!game.pendingCenterLoss && (game.turn !== previousTurn || !room.turnDeadlineAt)) startTurnDeadline(room);
  room.revision++;
  room.status = game.result ? "complete" : "active";
  room.updatedAt = new Date().toISOString();
  appendRoomEvent(room, playerId, command, action.message);
  room.commandReceipts.push({ commandId, playerId, revision: room.revision, message: action.message });
  room.commandReceipts = room.commandReceipts.slice(-300);
  await appendRoomAudit(room, playerId, commandId, auditSafeCommand(command) as RoomCommand);
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
