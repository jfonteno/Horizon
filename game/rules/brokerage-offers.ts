import type { BrokerageOffer, GameState, TradeBundle } from "../types";
import { brokerTrade } from "./faction-operations";
import { projectedOrderBudget } from "./purchases";

export function proposeBrokerage(
  game: GameState, meridianId: number, a: number, b: number,
  aGives: TradeBundle, bGives: TradeBundle, id: string,
) {
  if (game.brokerageOffers.some((offer) => offer.id === id))
    return { ok: false, message: "That brokerage offer already exists." };
  if (game.brokerageOffers.some((offer) => offer.status === "pending" && offer.createdTurn === game.turn &&
    offer.meridianId === meridianId && [offer.a, offer.b].sort().join(":") === [a, b].sort().join(":")))
    return { ok: false, message: "A brokerage offer between these civilizations is already awaiting approval." };
  if (!game.players[a] || !game.players[b]) return { ok: false, message: "Choose two active civilizations." };
  const preview = structuredClone(game);
  const eligibility = brokerTrade(preview, meridianId, a, b, aGives, bGives);
  if (!eligibility.ok) return eligibility;
  if (["material", "currency", "research"].every((resource) => aGives[resource as keyof TradeBundle] === bGives[resource as keyof TradeBundle]))
    return { ok: false, message: "A brokered exchange must give each party something different." };
  game.brokerageOffers.push({ id, meridianId, a, b, aGives, bGives, approvedBy: [], createdTurn: game.turn, status: "pending" });
  return { ok: true, message: "Brokerage offered. Both trading civilizations must approve before resources move." };
}

export function respondBrokerage(game: GameState, id: string, actorId: number, accept: boolean) {
  const offer = game.brokerageOffers.find((candidate) => candidate.id === id);
  if (!offer || offer.status !== "pending" || offer.createdTurn !== game.turn)
    return { ok: false, message: "That brokerage offer is no longer pending." };
  if (actorId !== offer.a && actorId !== offer.b)
    return { ok: false, message: "Only a trading civilization may answer this brokerage offer." };
  if (offer.approvedBy.includes(actorId))
    return { ok: false, message: "This civilization has already approved the offer." };
  if (!accept) {
    offer.status = "rejected";
    return { ok: true, message: "Brokerage offer declined. No resources were exchanged." };
  }
  if (offer.approvedBy.length === 0) {
    offer.approvedBy.push(actorId);
    return { ok: true, message: "Brokerage approved. Awaiting the other civilization's consent." };
  }
  const preview = structuredClone(game);
  const possible = brokerTrade(preview, offer.meridianId, offer.a, offer.b, offer.aGives, offer.bGives);
  const budgetConflict = possible.ok && preview.orderProtocol.submissions.some((submission) =>
    [offer.a, offer.b].includes(submission.playerId) &&
    projectedOrderBudget(preview, submission.playerId, submission.orders).error);
  const result = budgetConflict
    ? { ok: false, message: "The exchange would consume resources committed to sealed Orders." }
    : possible.ok ? brokerTrade(game, offer.meridianId, offer.a, offer.b, offer.aGives, offer.bGives) : possible;
  if (!result.ok) {
    offer.status = "cancelled";
    return { ok: true, message: `Brokerage could not settle: ${result.message} No resources were exchanged.` };
  }
  offer.approvedBy.push(actorId);
  offer.status = "accepted";
  return result;
}

export function botBrokerageDecision(game: GameState, offer: BrokerageOffer, botId: number) {
  const gives = botId === offer.a ? offer.aGives : offer.bGives;
  const receives = botId === offer.a ? offer.bGives : offer.aGives;
  const stock = game.players[botId].resources;
  const resources = ["material", "currency", "research"] as const;
  const value = (bundle: TradeBundle) => resources.reduce((sum, resource) => sum + bundle[resource] *
    (stock[resource] < 2 ? 2.2 : stock[resource] < 5 ? 1.4 : 0.9), 0);
  // A small reciprocal exchange is welcome if it addresses a scarcity; never approve a gift.
  return value(receives) >= value(gives) * 0.8;
}
