import type {
  GameState,
  PlayerState,
  Resource,
  SecretOrder,
  TechnologyBranch,
} from "../types";
import { factionRules } from "../factions";
import { availableCivilianType, civilianLibrary } from "./faction-operations";
import { technologyCost } from "./diplomacy";
import { availableCarrierTypes, carrierCost, carrierLibrary, validateCarrierRoute } from "./fleet";
import { canPay, centerCosts, spend, tributeCosts } from "./economy";
import { availableExplorationTypes, explorationLibrary, validateExplorationPath } from "./exploration";
import { colonyShipDefinition } from "./colony";
import { finalEra, gateTarget } from "./format";
import { habitatSlots, shatteredConstructionCost } from "./shattered-reach";
import { removeCenterAt } from "./portals";
import { activePolicy, markPolicyUsed, policyCost } from "./policy-deck";

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
  if (construction.type === "colony") return colonyShipDefinition.name;
  if (construction.type === "civilian") return civilianLibrary[construction.civilian].name;
  if (construction.type === "exploration") return explorationLibrary[construction.vessel].name;
  if (construction.type === "arcology") return "Arcology";
  if (construction.type === "removeCenter") return "Remove Center";
  if (construction.type === "replaceCenter") return "Replace Center";
  if (construction.type === "enhanceCenter") return "Enhanced Center";
  if (construction.type === "factory") return "Factory";
  if (construction.type === "mobileHabitat") return construction.vessel === "arkship" ? "Arkship" : construction.vessel === "grandArk" ? "Grand Ark" : "Worldship";
  if (construction.type === "mobileCenter") return `${construction.center} Mobile Center`;
  if (construction.type === "blockade") return "Blockade Platform";
  if (construction.type === "caravanGuard") return "Caravan Guard";
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
  const shattered = shatteredConstructionCost(game, playerId, habitatId, construction);
  if (shattered) return shattered;
  if (!habitat?.tier || habitat.owner !== playerId)
    return unavailable("Select one of your Habitats.");

  if (construction.type === "removeCenter") {
    if (!Number.isInteger(construction.centerIndex) || !habitat.centers[construction.centerIndex]) return unavailable("Choose an installed Center to remove.");
    return { label: `Remove ${habitat.centers[construction.centerIndex]} Center`, cost: {}, available: true };
  }
  if (construction.type === "replaceCenter") {
    const old = habitat.centers[construction.centerIndex];
    if (!Number.isInteger(construction.centerIndex) || !old) return unavailable("Choose an installed Center to replace.");
    if (construction.center === "factory") return unavailable("Factories require the Guilds Factory construction.");
    if (construction.center === "defense" && habitat.centers.some((center, index) => index !== construction.centerIndex && center === "defense")) return unavailable("This Habitat already has a Defense Grid.");
    const cost = construction.center === "defense" ? { material: 2, currency: 1, labor: 1 } : factionRules(player) === "helix" && construction.center === "research" ? { material: 1, currency: 1, labor: 1 } : { ...centerCosts[construction.center] };
    if (construction.center !== "defense" && factionRules(player) === "aegis" && !player.legacyMetrics.aegisEconomicCenterBuilt) cost.currency = Math.max(0, (cost.currency || 0) - 1);
    return { label: `Replace ${old} with ${construction.center}`, cost: policyCost(game, playerId, "center", cost, construction.center !== "defense"), available: true };
  }

  if (construction.type === "module") {
    const cost = { material: 3, currency: 2, labor: factionRules(player) === "foundry" ? 0 : 2 };
    return { label: "Habitat Module", cost, available: true };
  }
  if (construction.type === "upgrade") {
    if (habitat.tier === "Metropolis" || habitat.tier === "Arcology") return unavailable("This Habitat is at its maximum tier.");
    if (factionRules(player) === "spires" && habitat.tier === "Colony") return unavailable("Spires upgrade Colonies directly to Arcologies at Resource III.");
    const nextLevel = habitat.tier === "Outpost" ? 2 : 3;
    const cost = habitat.tier === "Outpost"
      ? { material: 2, currency: 2, labor: 2 }
      : { material: 3, currency: 3, labor: 3 };
    if (factionRules(player) === "spires") cost.currency = Math.max(0, cost.currency - 1);
    if (player.tech.Resource < nextLevel)
      return unavailable(`Requires Resource ${nextLevel}.`, cost);
    return { label: `Upgrade to ${habitat.tier === "Outpost" ? "Colony" : "Metropolis"}`, cost, available: true };
  }
  if (construction.type === "center") {
    if (construction.center === "factory") return unavailable("Factories require the Guilds Factory construction.");
    const cap = habitatSlots(habitat.tier);
    const cost = construction.center === "defense"
      ? { material: 2, currency: 1, labor: 1 }
      : factionRules(player) === "helix" && construction.center === "research"
        ? { material: 1, currency: 1, labor: 1 }
        : { ...centerCosts[construction.center] };
    if (factionRules(player) === "guilds" && construction.center !== "defense" && player.legacyMetrics.builtCenters[game.era - 1] === 0)
      cost.currency = Math.max(0, (cost.currency || 0) - 1);
    if (factionRules(player) === "aegis" && construction.center !== "defense" && !player.legacyMetrics.aegisEconomicCenterBuilt)
      cost.currency = Math.max(0, (cost.currency || 0) - 1);
    if (habitat.centers.length + (habitat.portalDestinations?.length || 0) >= cap) return unavailable("No open Center slots.", cost);
    if (construction.center === "defense" && habitat.centers.includes("defense"))
      return unavailable("This Habitat already has a Defense Grid.", cost);
    return { label: constructionName(construction), cost: policyCost(game, playerId, "center", cost, construction.center !== "defense"), available: true };
  }
  if (construction.type === "carrier") {
    const cost = policyCost(game, playerId, "carrier", carrierCost(player, construction.carrier));
    if (!availableCarrierTypes(player).includes(construction.carrier)) {
      const definition = carrierLibrary[construction.carrier];
      return unavailable(definition.faction === factionRules(player)
        ? `Requires Military ${definition.tech}.`
        : "This vessel is not available to your faction.", cost);
    }
    return { label: constructionName(construction), cost, available: true };
  }
  if (construction.type === "colony")
    return { label: colonyShipDefinition.name, cost: colonyShipDefinition.cost, available: true };
  if (construction.type === "civilian") {
    const definition = civilianLibrary[construction.civilian];
    const available = availableCivilianType(game, playerId) === construction.civilian;
    return available
      ? { label: definition.name, cost: definition.cost, available: true }
      : unavailable("Requires its matching faction at Exploration II.", definition.cost);
  }
  if (construction.type === "exploration") {
    const definition = explorationLibrary[construction.vessel];
    return availableExplorationTypes(game, playerId).includes(construction.vessel)
      ? { label: definition.name, cost: definition.cost, available: true }
      : unavailable("Requires higher Exploration Technology.", definition.cost);
  }
  if (construction.type !== "recruit") return unavailable("That construction is not available here.");
  const cost = policyCost(game, playerId, "recruit", { currency: construction.pairs, labor: construction.pairs });
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
  if (order.kind === "policyVote") return { influence: order.influence };
  if (order.kind === "tribute") return policyCost(game, playerId, "tribute", tributeCosts[game.era]);
  return null;
}

export function projectedOrderBudget(
  game: GameState,
  playerId: number,
  orders: SecretOrder[],
): { remaining: PlayerState; error?: string } {
  const remaining = structuredClone(game.players[playerId]);
  for (const order of orders) if (order.kind === "explorerMove") {
    const validation = validateExplorationPath(game, playerId, order.vesselId, order.destination, order.path);
    if (!validation.ok) return { remaining, error: validation.message };
  }
  for (const order of orders) if (order.kind === "carrierMove") {
    const validation = validateCarrierRoute(game, playerId, order.carrierIds, order.destination, order.path);
    if (!validation.ok) return { remaining, error: validation.message };
  }
  // Quotes only mutate a Habitat's tier/Center slots. Do not clone histories
  // and AI reports for every candidate in the planner's beam search.
  const projected = { ...game, policyUses: { ...(game.policyUses || {}) }, players: game.players.map((player) => player.id === playerId ? remaining : player), hexes: [...game.hexes], mobileHabitats: game.mobileHabitats.map((mobile) => ({ ...mobile, centers: [...mobile.centers] })) };
  const copiedHabitats = new Set<string>();
  const usedConstruction = new Set<string>();
  const constructionOrders = orders.filter(
    (order): order is ConstructionOrder => order.kind === "construct",
  );
  for (const order of constructionOrders) {
    const construction = order.construction;
    const mobileId = construction.type === "mobileCenter" || construction.type === "caravanGuard" ? construction.mobileHabitatId : undefined;
    const constructionKey = mobileId ? `mobile:${mobileId}` : `habitat:${order.habitatId}`;
    if (construction.type !== "colony") {
      if (usedConstruction.has(constructionKey)) return { remaining, error: `${order.habitatId}: only one construction action per Habitat or mobile Habitat per Turn.` };
      if (mobileId ? projected.mobileHabitats.some((mobile) => mobile.id === mobileId && mobile.constructionUsedTurn === game.turn) : game.hexes.some((hex) => hex.id === order.habitatId && hex.constructionUsedTurn === game.turn)) return { remaining, error: `${order.habitatId}: construction was already used this Turn.` };
      usedConstruction.add(constructionKey);
    }
    if (!copiedHabitats.has(order.habitatId)) {
      const index = projected.hexes.findIndex((hex) => hex.id === order.habitatId);
      if (index >= 0) projected.hexes[index] = { ...projected.hexes[index], centers: [...projected.hexes[index].centers] };
      copiedHabitats.add(order.habitatId);
    }
    const quote = constructionQuote(projected, playerId, order.habitatId, order.construction);
    if (!quote.available) return { remaining, error: `${quote.label}: ${quote.reason}` };
    const cost = { ...quote.cost };
    const pendingVote = (game.turn - 1) % 4 === 0 && game.policyElection?.era === game.era && !game.policyElection.votingClosed;
    if (pendingVote && ((construction.type === "carrier" && game.policyElection!.choices.some((id) => ["civilian-investment", "horizon-priority", "arms-limitation"].includes(id))) ||
      (construction.type === "recruit" && game.policyElection!.choices.includes("arms-limitation"))))
      cost.currency = (cost.currency || 0) + 1;
    if (!canPay(remaining, cost))
      return { remaining, error: `${quote.label}: insufficient resources or Labor.` };
    spend(remaining, cost);
    const habitat = projected.hexes.find((hex) => hex.id === order.habitatId)!;
    if (order.construction.type === "upgrade") habitat.tier = habitat.tier === "Outpost" ? "Colony" : "Metropolis";
    if (order.construction.type === "center") {
      habitat.centers.push(order.construction.center);
      if (factionRules(remaining) === "aegis" && order.construction.center !== "defense")
        remaining.legacyMetrics.aegisEconomicCenterBuilt = true;
    }
    if (order.construction.type === "arcology") habitat.tier = "Arcology";
    if (order.construction.type === "removeCenter") removeCenterAt(habitat, order.construction.centerIndex, remaining);
    if (order.construction.type === "replaceCenter") {
      removeCenterAt(habitat, order.construction.centerIndex, remaining);
      habitat.centers.push(order.construction.center);
    }
    if (((order.construction.type === "center" || order.construction.type === "replaceCenter") && order.construction.center !== "defense" || ["factory", "mobileCenter"].includes(order.construction.type)) && activePolicy(projected) === "infrastructure-grants") markPolicyUsed(projected, playerId, "center");
    if (order.construction.type === "carrier" && activePolicy(projected) === "arms-expansion") markPolicyUsed(projected, playerId, "carrier");
    if (order.construction.type === "factory") habitat.centers.push("factory");
    if (order.construction.type === "enhanceCenter") {
      habitat.enhancedCenterIndices = [...(habitat.enhancedCenterIndices || []), order.construction.centerIndex];
      remaining.laborPenalty = (remaining.laborPenalty || 0) + 1;
      remaining.laborCap = Math.max(1, remaining.laborCap - 1);
      remaining.labor = Math.min(remaining.labor, remaining.laborCap);
    }
    if (order.construction.type === "mobileCenter") {
      const mobileId = order.construction.mobileHabitatId, center = order.construction.center;
      projected.mobileHabitats.find((mobile) => mobile.id === mobileId)?.centers.push(center);
    }
  }
  for (const order of orders.filter((candidate) => candidate.kind === "technology")) {
    const quote = technologyQuote(game, playerId, order.branch);
    if (!quote.available) return { remaining, error: `${quote.label}: ${quote.reason}` };
    if (!canPay(remaining, quote.cost))
      return { remaining, error: `${quote.label}: insufficient resources or Labor.` };
    spend(remaining, quote.cost);
    if (activePolicy(projected) === "scientific-exchange") markPolicyUsed(projected, playerId, "technology");
  }
  for (const order of orders.filter((candidate) => candidate.kind === "policyVote")) {
    if (order.kind !== "policyVote") continue;
    if ((game.turn - 1) % 4 !== 0 || game.policyElection?.era !== game.era || game.policyElection.votingClosed || !game.policyElection.choices.includes(order.policyId) || !Number.isInteger(order.influence) || order.influence < 1) return { remaining, error: "Choose a revealed Policy and pledge an affordable amount of Influence at the beginning of an Era." };
    if (remaining.resources.influence < order.influence) return { remaining, error: "Insufficient Influence for the Policy vote." };
    remaining.resources.influence -= order.influence;
  }
  const openingPortals = orders.filter((candidate): candidate is Extract<SecretOrder, { kind: "openPortal" }> => candidate.kind === "openPortal");
  const home = game.hexes.find((hex) => hex.kind === "home" && hex.originalOwner === playerId && hex.owner === playerId);
  const plannedDestinations = new Set<string>();
  let freeSlots = home ? habitatSlots(home.tier) - home.centers.length - (home.portalDestinations?.length || 0) : 0;
  for (const order of openingPortals) {
    const vessel = game.players[playerId].explorationVessels.find((unit) => unit.id === order.vesselId && unit.readyTurn <= game.turn);
    const target = game.hexes.find((hex) => hex.id === vessel?.hex);
    if (!home || remaining.tech.Exploration < 4 || !vessel || !target?.revealed || target.kind === "rift" || target.id === home.id || home.portalDestinations?.includes(target.id) || plannedDestinations.has(target.id)) return { remaining, error: "Portal: choose a ready Explorer on a distinct revealed hex and control your Homeworld at Exploration IV." };
    if (order.replaceCenterIndex !== undefined) {
      if (!Number.isInteger(order.replaceCenterIndex) || !home.centers[order.replaceCenterIndex]) return { remaining, error: "Portal: select a Homeworld Center to replace." };
    } else if (freeSlots-- <= 0) return { remaining, error: "Portal: no open Homeworld Center slot. Choose a Center to replace." };
    plannedDestinations.add(target.id);
  }
  let bombardments = game.bombardmentsThisTurn[playerId] || 0;
  for (let index = 0; index < orders.filter((candidate) => candidate.kind === "bombard").length; index++) {
    if (bombardments > 0) {
      if (remaining.resources.material < 1)
        return { remaining, error: "Bombardment ammunition: insufficient Material." };
      remaining.resources.material--;
    }
    bombardments++;
  }
  let tributeCount = 0;
  for (let index = 0; index < orders.filter((candidate) => candidate.kind === "tribute").length; index++) {
    if (game.gate >= gateTarget(game))
      return { remaining, error: "The Horizon Gate is complete. No further Tributes may be submitted." };
    if (game.era < finalEra(game) && (remaining.eraTributes[game.era - 1] || tributeCount > 0))
      return { remaining, error: "Only one Gate Tribute may be submitted in this Era." };
    const tributeCost = policyCost(projected, playerId, "tribute", tributeCosts[game.era]);
    if (!canPay(remaining, tributeCost))
      return { remaining, error: "Horizon Gate Tribute: insufficient resources or Labor." };
    spend(remaining, tributeCost);
    if (activePolicy(projected) === "horizon-priority") markPolicyUsed(projected, playerId, "tribute");
    tributeCount++;
  }
  return { remaining };
}

function calculateOrderCosts(game: GameState, playerId: number, orders: SecretOrder[]) {
  const projected = structuredClone(game);
  const total: PurchaseCost = {};
  const individual: PurchaseCost[] = [];
  for (const order of orders) {
    const cost = purchaseCostForOrder(projected, playerId, order);
    individual.push(cost || {});
    if (!cost) continue;
    for (const [resource, amount] of Object.entries(cost))
      total[resource as keyof PurchaseCost] = (total[resource as keyof PurchaseCost] || 0) + amount;
    if (order.kind === "construct") {
      const habitat = projected.hexes.find((hex) => hex.id === order.habitatId);
      if (habitat && order.construction.type === "upgrade") habitat.tier = habitat.tier === "Outpost" ? "Colony" : "Metropolis";
      if (habitat && order.construction.type === "center") habitat.centers.push(order.construction.center);
      if (habitat && order.construction.type === "arcology") habitat.tier = "Arcology";
      if (habitat && order.construction.type === "factory") habitat.centers.push("factory");
      if (habitat && order.construction.type === "removeCenter") removeCenterAt(habitat, order.construction.centerIndex, projected.players[playerId]);
      if (habitat && order.construction.type === "replaceCenter") {
        removeCenterAt(habitat, order.construction.centerIndex, projected.players[playerId]);
        habitat.centers.push(order.construction.center);
      }
      if (((order.construction.type === "center" || order.construction.type === "replaceCenter") && order.construction.center !== "defense" || ["factory", "mobileCenter"].includes(order.construction.type)) && activePolicy(projected) === "infrastructure-grants") markPolicyUsed(projected, playerId, "center");
      if (order.construction.type === "carrier" && activePolicy(projected) === "arms-expansion") markPolicyUsed(projected, playerId, "carrier");
    }
    if (order.kind === "technology" && activePolicy(projected) === "scientific-exchange") markPolicyUsed(projected, playerId, "technology");
    if (order.kind === "tribute" && activePolicy(projected) === "horizon-priority") markPolicyUsed(projected, playerId, "tribute");
  }
  return { total, individual };
}

export function totalOrderCost(game: GameState, playerId: number, orders: SecretOrder[]) {
  return calculateOrderCosts(game, playerId, orders).total;
}

export function individualOrderCosts(game: GameState, playerId: number, orders: SecretOrder[]) {
  return calculateOrderCosts(game, playerId, orders).individual;
}
