import type {
  GameState,
  PlayerState,
  Resource,
  SecretOrder,
  TechnologyBranch,
} from "../types";
import { availableCivilianType, civilianLibrary } from "./faction-operations";
import { technologyCost } from "./diplomacy";
import { availableCarrierTypes, carrierCost, carrierLibrary } from "./fleet";
import { canPay, centerCosts, spend, tributeCosts } from "./economy";

export type PurchaseCost = Partial<Record<Resource | "labor", number>>;
export type ConstructionOrder = Extract<SecretOrder, { kind: "construct" }>;

export type PurchaseQuote = {
  label: string;
  cost: PurchaseCost;
  available: boolean;
  reason?: string;
};

const resourceCodes: Record<Resource | "labor", string> = {
  material: "M",
  currency: "C",
  research: "R",
  influence: "I",
  labor: "L",
};

export function formatPurchaseCost(cost: PurchaseCost) {
  const entries = (["material", "currency", "research", "influence", "labor"] as const)
    .filter((resource) => (cost[resource] || 0) > 0)
    .map((resource) => `${cost[resource]}${resourceCodes[resource]}`);
  return entries.length ? entries.join(" · ") : "No cost";
}

function constructionName(construction: ConstructionOrder["construction"]) {
  if (construction.type === "module") return "Habitat Module";
  if (construction.type === "upgrade") return "Habitat Upgrade";
  if (construction.type === "center")
    return construction.center === "defense"
      ? "Defense Grid"
      : `${construction.center[0].toUpperCase()}${construction.center.slice(1)} Center`;
  if (construction.type === "carrier") return carrierLibrary[construction.carrier].name;
  if (construction.type === "civilian") return civilianLibrary[construction.civilian].name;
  return `${construction.pairs * 2} Combat Units`;
}

export function constructionQuote(
  game: GameState,
  playerId: number,
  habitatId: string,
  construction: ConstructionOrder["construction"],
): PurchaseQuote {
  const player = game.players[playerId];
  const habitat = game.hexes.find((hex) => hex.id === habitatId);
  const unavailable = (reason: string, cost: PurchaseCost = {}): PurchaseQuote => ({
    label: constructionName(construction),
    cost,
    available: false,
    reason,
  });
  if (!habitat?.tier || habitat.owner !== playerId)
    return unavailable("Select one of your Habitats.");
  if (habitat.constructionUsedTurn === game.turn)
    return unavailable("This Habitat already used its Construction Order.");

  if (construction.type === "module") {
    const cost = { material: 3, currency: 2, labor: player.faction === "foundry" ? 0 : 2 };
    return { label: "Habitat Module", cost, available: true };
  }
  if (construction.type === "upgrade") {
    if (habitat.tier === "Metropolis") return unavailable("Metropolis is the maximum tier.");
    const nextLevel = habitat.tier === "Outpost" ? 2 : 3;
    const cost = habitat.tier === "Outpost"
      ? { material: 2, currency: 2, labor: 2 }
      : { material: 3, currency: 3, labor: 3 };
    if (player.tech.Resource < nextLevel)
      return unavailable(`Requires Resource ${nextLevel}.`, cost);
    return { label: `Upgrade to ${habitat.tier === "Outpost" ? "Colony" : "Metropolis"}`, cost, available: true };
  }
  if (construction.type === "center") {
    const cap = habitat.tier === "Outpost" ? 1 : habitat.tier === "Colony" ? 2 : 3;
    const cost = construction.center === "defense"
      ? { material: 2, currency: 1, labor: 1 }
      : player.faction === "helix" && construction.center === "research"
        ? { material: 1, currency: 1, labor: 1 }
        : centerCosts[construction.center];
    if (habitat.centers.length >= cap) return unavailable("No open Center slots.", cost);
    if (construction.center === "defense" && habitat.centers.includes("defense"))
      return unavailable("This Habitat already has a Defense Grid.", cost);
    return { label: constructionName(construction), cost, available: true };
  }
  if (construction.type === "carrier") {
    const cost = carrierCost(player, construction.carrier);
    if (!availableCarrierTypes(player).includes(construction.carrier))
      return unavailable("Requires higher Military Technology.", cost);
    return { label: constructionName(construction), cost, available: true };
  }
  if (construction.type === "civilian") {
    const definition = civilianLibrary[construction.civilian];
    const available = availableCivilianType(game, playerId) === construction.civilian;
    return available
      ? { label: definition.name, cost: definition.cost, available: true }
      : unavailable("Requires its matching faction at Exploration II.", definition.cost);
  }
  const cost = { currency: construction.pairs, labor: construction.pairs };
  if (!Number.isInteger(construction.pairs) || construction.pairs < 1)
    return unavailable("Recruit at least two Combat Units.", cost);
  return { label: `${construction.pairs * 2} Combat Units`, cost, available: true };
}

export function technologyQuote(
  game: GameState,
  playerId: number,
  branch: TechnologyBranch,
): PurchaseQuote {
  const player = game.players[playerId];
  const next = player.tech[branch] + 1;
  if (next > 4)
    return { label: `${branch} IV`, cost: {}, available: false, reason: "Maximum level reached." };
  const cost = technologyCost(game, playerId, branch, next);
  if (player.techAdvancedTurn === game.turn)
    return { label: `${branch} ${next}`, cost, available: false, reason: "Technology already advanced this Turn." };
  return { label: `${branch} ${next}`, cost, available: true };
}

export function purchaseCostForOrder(
  game: GameState,
  playerId: number,
  order: SecretOrder,
): PurchaseCost | null {
  if (order.kind === "construct")
    return constructionQuote(game, playerId, order.habitatId, order.construction).cost;
  if (order.kind === "technology") return technologyQuote(game, playerId, order.branch).cost;
  if (order.kind === "tribute") return tributeCosts[game.era];
  return null;
}

export function projectedOrderBudget(
  game: GameState,
  playerId: number,
  orders: SecretOrder[],
): { remaining: PlayerState; error?: string } {
  const remaining = structuredClone(game.players[playerId]);
  const constructionOrders = orders.filter(
    (order): order is ConstructionOrder => order.kind === "construct",
  );
  for (const order of constructionOrders) {
    const quote = constructionQuote(game, playerId, order.habitatId, order.construction);
    if (!quote.available) return { remaining, error: `${quote.label}: ${quote.reason}` };
    if (!canPay(remaining, quote.cost))
      return { remaining, error: `${quote.label}: insufficient resources or Labor.` };
    spend(remaining, quote.cost);
  }
  for (const order of orders.filter((candidate) => candidate.kind === "technology")) {
    const quote = technologyQuote(game, playerId, order.branch);
    if (!quote.available) return { remaining, error: `${quote.label}: ${quote.reason}` };
    if (!canPay(remaining, quote.cost))
      return { remaining, error: `${quote.label}: insufficient resources or Labor.` };
    spend(remaining, quote.cost);
  }
  let tributeCount = 0;
  for (let index = 0; index < orders.filter((candidate) => candidate.kind === "tribute").length; index++) {
    if (game.gate >= game.players.length * 3)
      return { remaining, error: "The Horizon Gate is complete. No further Tributes may be submitted." };
    if (game.era < 4 && (remaining.eraTributes[game.era - 1] || tributeCount > 0))
      return { remaining, error: "Only one Gate Tribute may be submitted in this Era." };
    if (!canPay(remaining, tributeCosts[game.era]))
      return { remaining, error: "Horizon Gate Tribute: insufficient resources or Labor." };
    spend(remaining, tributeCosts[game.era]);
    tributeCount++;
  }
  return { remaining };
}

export function totalOrderCost(game: GameState, playerId: number, orders: SecretOrder[]) {
  const total: PurchaseCost = {};
  for (const order of orders) {
    const cost = purchaseCostForOrder(game, playerId, order);
    if (!cost) continue;
    for (const [resource, amount] of Object.entries(cost))
      total[resource as keyof PurchaseCost] = (total[resource as keyof PurchaseCost] || 0) + amount;
  }
  return total;
}
