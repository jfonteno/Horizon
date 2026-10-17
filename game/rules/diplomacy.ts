import { activePolicy, markPolicyUsed, policyCost, policyUsed } from "./policy-deck";
import type {
  AgreementProposal,
  AgreementType,
  DiplomacyProposal,
  FormalAgreement,
  GameState,
  PlayerState,
  TechnologyBranch,
  TechnologyProposal,
  TradeBundle,
  TradeProposal,
  TradableResource,
} from "../types";
import { factionRules } from "../factions";
import { technologyCosts } from "./economy";
import { projectedOrderBudget } from "./purchases";
import { blockadeConstructionCost, legalBlockadeSaleDestinations, placeCommissionedBlockade, placeSoldBlockade } from "./blockades";

export const emptyTradeBundle = (): TradeBundle => ({
  material: 0,
  currency: 0,
  research: 0,
  labor: 0,
});

export const agreementNames: Record<AgreementType, string> = {
  trade: "Trade Agreement",
  nonAggression: "Non-Aggression Pact",
  openBorders: "Open Borders",
  research: "Research Agreement",
  defensive: "Defensive Pact",
  alliance: "Alliance",
};

export function hasStationingPermission(game: GameState, hostId: number, guestId: number, kind: "defensive" | "envoy") {
  return game.stationingPermissions.some((permission) => permission.hostId === hostId && permission.guestId === guestId && permission.kind === kind);
}

export function setStationingPermission(game: GameState, hostId: number, guestId: number, kind: "defensive" | "envoy", allowed: boolean) {
  if (hostId === guestId || !game.players[guestId]) return { ok: false, message: "Choose another civilization." };
  if (kind === "defensive" && !hasBenefit(game, hostId, guestId, "defensive")) return { ok: false, message: "A Defensive Pact or Alliance is required." };
  if (kind === "envoy" && factionRules(game.players[guestId]) !== "aurelians") return { ok: false, message: "Only Aurelian Envoys require this permission." };
  game.stationingPermissions = game.stationingPermissions.filter((permission) => !(permission.hostId === hostId && permission.guestId === guestId && permission.kind === kind));
  if (allowed) game.stationingPermissions.push({ hostId, guestId, kind });
  return { ok: true, message: `${game.players[guestId].name} ${allowed ? "may now" : "may no longer"} ${kind === "envoy" ? "host Envoys at" : "co-station forces in"} ${game.players[hostId].name} Habitats.` };
}

export const agreementRules: Record<
  AgreementType,
  { policy: number; cost: number; effect: string }
> = {
  trade: {
    policy: 1,
    cost: 1,
    effect: "Unlimited direct-trade range and permanent Labor transfers.",
  },
  nonAggression: {
    policy: 1,
    cost: 1,
    effect:
      "Blocks hostile movement, attacks, and capture between the parties.",
  },
  openBorders: {
    policy: 2,
    cost: 1,
    effect:
      "Permits peaceful movement through each party's controlled Habitat hexes.",
  },
  research: {
    policy: 2,
    cost: 2,
    effect: "First Technology advance each Era costs 1 less Research.",
  },
  defensive: {
    policy: 3,
    cost: 2,
    effect:
      "With the Habitat owner's permission, co-stationed forces combine with its defense as one deterministic coalition.",
  },
  alliance: {
    policy: 3,
    cost: 3,
    effect:
      "Includes Trade, Open Borders, Defensive Pact, non-hostility, and permission-based coalition combat.",
  },
};

const pairMatches = (parties: [number, number], a: number, b: number) =>
  (parties[0] === a && parties[1] === b) ||
  (parties[0] === b && parties[1] === a);

export function activeAgreements(
  game: GameState,
  a?: number,
  b?: number,
): FormalAgreement[] {
  return game.agreements.filter(
    (agreement) =>
      (agreement.endsAfterTurn === undefined ||
        agreement.endsAfterTurn >= game.turn) &&
      (a === undefined ||
        b === undefined ||
        pairMatches(agreement.parties, a, b)),
  );
}

export function hasAgreement(
  game: GameState,
  a: number,
  b: number,
  type: AgreementType,
): boolean {
  return activeAgreements(game, a, b).some(
    (agreement) => agreement.type === type,
  );
}

export function hasBenefit(
  game: GameState,
  a: number,
  b: number,
  benefit: "trade" | "openBorders" | "nonAggression" | "defensive",
): boolean {
  if (hasAgreement(game, a, b, "alliance")) return true;
  return hasAgreement(game, a, b, benefit);
}

function cube(id: string): [number, number, number] {
  const [row, column] = id.split("-").map(Number);
  const x = column;
  const z = row - (column - (column & 1)) / 2;
  return [x, -x - z, z];
}

export function hexDistance(a: string, b: string): number {
  const ac = cube(a),
    bc = cube(b);
  return Math.max(
    Math.abs(ac[0] - bc[0]),
    Math.abs(ac[1] - bc[1]),
    Math.abs(ac[2] - bc[2]),
  );
}

export function habitatDistance(
  game: GameState,
  a: number,
  b: number,
): number | null {
  const habitatsA = game.hexes.filter((hex) => hex.owner === a && hex.tier);
  const habitatsB = game.hexes.filter((hex) => hex.owner === b && hex.tier);
  if (!habitatsA.length || !habitatsB.length) return null;
  return Math.min(
    ...habitatsA.flatMap((first) =>
      habitatsB.map((second) => hexDistance(first.id, second.id)),
    ),
  );
}

export function isContacted(game: GameState, a: number, b: number): boolean {
  const distance = habitatDistance(game, a, b);
  return (
    game.players[a].diplomacy.contacts.includes(b) ||
    (distance !== null && distance <= 5)
  );
}

export function establishContact(game: GameState, a: number, b: number): void {
  if (!game.players[a].diplomacy.contacts.includes(b))
    game.players[a].diplomacy.contacts.push(b);
  if (!game.players[b].diplomacy.contacts.includes(a))
    game.players[b].diplomacy.contacts.push(a);
}

export function refreshContacts(game: GameState): void {
  for (let a = 0; a < game.players.length; a++)
    for (let b = a + 1; b < game.players.length; b++) {
      const distance = habitatDistance(game, a, b);
      const vesselsA = [
        game.players[a].explorer,
        ...game.players[a].colonyShips.map((unit) => unit.hex),
        ...game.carriers
          .filter((carrier) => carrier.owner === a)
          .map((carrier) => carrier.hex),
        ...game.civilianUnits.filter((unit) => unit.owner === a).map((unit) => unit.hex),
      ];
      const vesselsB = [
        game.players[b].explorer,
        ...game.players[b].colonyShips.map((unit) => unit.hex),
        ...game.carriers
          .filter((carrier) => carrier.owner === b)
          .map((carrier) => carrier.hex),
        ...game.civilianUnits.filter((unit) => unit.owner === b).map((unit) => unit.hex),
      ];
      const habitatsA = game.hexes
        .filter((hex) => hex.owner === a && hex.tier)
        .map((hex) => hex.id);
      const habitatsB = game.hexes
        .filter((hex) => hex.owner === b && hex.tier)
        .map((hex) => hex.id);
      const encounter =
        vesselsA.some((vessel) =>
          habitatsB.some((home) => hexDistance(vessel, home) <= 1),
        ) ||
        vesselsB.some((vessel) =>
          habitatsA.some((home) => hexDistance(vessel, home) <= 1),
        );
      if ((distance !== null && distance <= 5) || encounter)
        establishContact(game, a, b);
    }
}

export function tradeEligibility(
  game: GameState,
  from: number,
  to: number,
): { ok: boolean; message: string; distance: number | null } {
  const distance = habitatDistance(game, from, to);
  if (activePolicy(game) === "open-markets" && isContacted(game, from, to) && !policyUsed(game, from, "open-markets", "turn"))
    return { ok: true, message: "Open Markets permits your first direct trade this Turn after contact.", distance };
  if (hasBenefit(game, from, to, "trade"))
    return {
      ok: true,
      message: "Trade Agreement removes the distance limit.",
      distance,
    };
  const economy = game.players[from].tech.Economy;
  if (economy >= 4)
    return {
      ok: true,
      message: "Economy IV provides unlimited direct-trade range.",
      distance,
    };
  if (economy >= 3)
    return isContacted(game, from, to)
      ? {
          ok: true,
          message:
            "Economy III permits unlimited trade with contacted civilizations.",
          distance,
        }
      : {
          ok: false,
          message: "Economy III requires contact before unlimited trade.",
          distance,
        };
  const limit = economy >= 2 ? 5 : 3;
  if (distance === null)
    return {
      ok: false,
      message: "Both civilizations need at least one Habitat.",
      distance,
    };
  return distance <= limit
    ? {
        ok: true,
        message: `Nearest Habitats are ${distance} hexes apart, within range ${limit}.`,
        distance,
      }
    : {
        ok: false,
        message: `Nearest Habitats are ${distance} hexes apart; your range is ${limit}.`,
        distance,
      };
}

export const bundleTotal = (bundle: TradeBundle) =>
  Object.values(bundle).reduce((sum, amount) => sum + (amount || 0), 0);

function validTradeBundle(bundle: TradeBundle) {
  return ["material", "currency", "research", "labor", "influence"].every((resource) => {
    const amount = bundle[resource as keyof TradeBundle] || 0;
    return Number.isInteger(amount) && amount >= 0 && amount <= 99;
  });
}

function influenceTradeEligibility(game: GameState, proposal: TradeProposal) {
  for (const [id, bundle] of [[proposal.from, proposal.offer], [proposal.to, proposal.request]] as [number, TradeBundle][]) {
    if ((bundle.influence || 0) > 0 &&
      (factionRules(game.players[id]) !== "aurelians" || game.players[id].tech.Policy < 2))
      return { ok: false, message: "Only Aurelians at Policy II may offer Influence in a direct trade." };
  }
  return { ok: true, message: "Influence trade is legal." };
}

function blockadeSaleEligibility(game: GameState, proposal: TradeProposal) {
  if (!proposal.blockadeId && !proposal.blockadeCommission) return { ok: true, message: "" };
  const seller = game.players[proposal.from];
  if (factionRules(seller) !== "aegis")
    return { ok: false, message: "Only Aegis may initiate a Blockade sale." };
  if (seller.tech.Economy < 2)
    return { ok: false, message: "Aegis Security Export requires Economy II." };
  if (proposal.blockadeCommission) {
    if (proposal.blockadeId) return { ok: false, message: "Choose either an existing Blockade or a new commission." };
    const eligibility = tradeEligibility(game, proposal.from, proposal.to);
    if (!eligibility.ok) return eligibility;
    if (proposal.request.labor !== 0 || proposal.request.influence || ["material", "currency", "research"].some((resource) =>
      !Number.isInteger(proposal.request[resource as TradableResource]) || proposal.request[resource as TradableResource] < 0))
      return { ok: false, message: "Commission fees must use non-negative Material, Currency, or Research." };
  } else {
    const blockade = game.blockades.find((candidate) => candidate.id === proposal.blockadeId && candidate.owner === proposal.from && (candidate.active || candidate.carrierId) && candidate.readyTurn <= game.turn);
    if (!blockade) return { ok: false, message: "The proposed Aegis Blockade is no longer available." };
    if (!activeAgreements(game, proposal.from, proposal.to).length)
      return { ok: false, message: "An existing Blockade may be sold only to a civilization with an active agreement." };
  }
  if (bundleTotal(proposal.offer))
    return { ok: false, message: "A Blockade sale may request payment but cannot include additional offered resources." };
  if (!legalBlockadeSaleDestinations(game, proposal.to).length)
    return { ok: false, message: "The buyer has no controlled hex available for this Blockade." };
  return { ok: true, message: "Blockade sale is legal." };
}

function blockadeCommissionTotal(fee: TradeBundle) {
  return { material: blockadeConstructionCost.material + fee.material,
    currency: blockadeConstructionCost.currency + fee.currency,
    research: fee.research, labor: blockadeConstructionCost.labor };
}

/** Remove quantities that appear on both sides so the proposal reflects its net exchange. */
export function normalizeTradeBundles(offer: TradeBundle, request: TradeBundle) {
  const normalizedOffer = { ...offer };
  const normalizedRequest = { ...request };
  for (const resource of ["material", "currency", "research", "labor", "influence"] as const) {
    const overlap = Math.min(normalizedOffer[resource] || 0, normalizedRequest[resource] || 0);
    if (overlap) {
      normalizedOffer[resource] = (normalizedOffer[resource] || 0) - overlap;
      normalizedRequest[resource] = (normalizedRequest[resource] || 0) - overlap;
    }
  }
  return { offer: normalizedOffer, request: normalizedRequest };
}

function availableLabor(game: GameState, playerId: number): number {
  const committed = game.pendingLabor
    .filter((change) => change.playerId === playerId && change.amount < 0)
    .reduce((sum, change) => sum - change.amount, 0);
  return Math.max(0, game.players[playerId].laborCap - committed);
}

function canProvide(
  game: GameState,
  playerId: number,
  bundle: TradeBundle,
): boolean {
  const player = game.players[playerId];
  return (
    player.resources.material >= bundle.material &&
    player.resources.currency >= bundle.currency &&
    player.resources.research >= bundle.research &&
    player.resources.influence >= (bundle.influence || 0) &&
    availableLabor(game, playerId) >= bundle.labor
  );
}

function transferBundle(
  game: GameState,
  from: number,
  to: number,
  bundle: TradeBundle,
): void {
  (["material", "currency", "research"] as TradableResource[]).forEach(
    (resource) => {
      game.players[from].resources[resource] -= bundle[resource];
      game.players[to].resources[resource] += bundle[resource];
    },
  );
  if (bundle.influence) {
    game.players[from].resources.influence -= bundle.influence;
    game.players[to].resources.influence += bundle.influence;
  }
  if (bundle.labor) {
    const effectiveTurn = game.turn + 1;
    game.pendingLabor.push({
      playerId: from,
      amount: -bundle.labor,
      effectiveTurn,
    });
    game.pendingLabor.push({
      playerId: to,
      amount: bundle.labor,
      effectiveTurn,
    });
  }
}

export function addTradeProposal(
  game: GameState,
  proposal: TradeProposal,
): { ok: boolean; message: string } {
  const normalized = normalizeTradeBundles(proposal.offer, proposal.request);
  proposal.offer = normalized.offer;
  proposal.request = normalized.request;
  if (!validTradeBundle(proposal.offer) || !validTradeBundle(proposal.request))
    return { ok: false, message: "Trade quantities must be non-negative whole numbers up to 99." };
  const influenceEligibility = influenceTradeEligibility(game, proposal);
  if (!influenceEligibility.ok) return influenceEligibility;
  const assetEligibility = blockadeSaleEligibility(game, proposal);
  if (!assetEligibility.ok) return assetEligibility;
  const eligibility = proposal.blockadeId || proposal.blockadeCommission ? { ok: true, message: assetEligibility.message } : tradeEligibility(game, proposal.from, proposal.to);
  if (!eligibility.ok) return eligibility;
  if ((proposal.counterDepth || 0) > 3)
    return { ok: false, message: "Counteroffer chains are limited to three revisions." };
  if (proposal.expiresAfterTurn !== undefined && proposal.expiresAfterTurn < game.turn)
    return { ok: false, message: "That trade proposal has already expired." };
  if (!proposal.blockadeCommission && !bundleTotal(proposal.offer) && !bundleTotal(proposal.request))
    return {
      ok: false,
      message: "A proposal must offer or request something.",
    };
  if (
    (proposal.offer.labor || proposal.request.labor) &&
    !hasBenefit(game, proposal.from, proposal.to, "trade")
  )
    return {
      ok: false,
      message: "Labor transfers require a Trade Agreement or Alliance.",
    };
  if (!canProvide(game, proposal.from, proposal.offer))
    return {
      ok: false,
      message: "The proposer cannot currently provide that offer.",
    };
  if (!canProvide(game, proposal.to, proposal.request) || proposal.blockadeCommission &&
    !canPayRecord(game.players[proposal.to], blockadeCommissionTotal(proposal.request)))
    return {
      ok: false,
      message: "The recipient cannot currently provide the requested resources.",
    };
  establishContact(game, proposal.from, proposal.to);
  game.proposals.push(proposal);
  game.log.unshift(
    `${game.players[proposal.from].name} sent a direct-trade proposal to ${game.players[proposal.to].name}.`,
  );
  return { ok: true, message: "Trade proposal sent." };
}

export function counterTradeProposal(
  game: GameState,
  playerId: number,
  originalId: string,
  id: string,
  offer: TradeBundle,
  request: TradeBundle,
) {
  const original = game.proposals.find((candidate): candidate is TradeProposal => candidate.id === originalId && candidate.kind === "trade");
  if (!original || original.status !== "pending") return { ok: false, message: "That trade proposal is no longer open." };
  if (original.to !== playerId) return { ok: false, message: "Only the recipient may counter that proposal." };
  if (original.blockadeId || original.blockadeCommission) return { ok: false, message: "Blockade sales must be accepted or rejected. Ask the Aegis player to send a revised offer." };
  const proposal: TradeProposal = {
    id,
    kind: "trade",
    from: playerId,
    to: original.from,
    offer: structuredClone(offer),
    request: structuredClone(request),
    createdTurn: game.turn,
    status: "pending",
    counterOf: original.id,
    counterDepth: (original.counterDepth || 0) + 1,
    expiresAfterTurn: game.turn,
  };
  const result = addTradeProposal(game, proposal);
  if (!result.ok) return result;
  original.status = "rejected";
  return { ok: true, message: "Counteroffer sent and the previous proposal closed." };
}

export function agreementCost(
  game: GameState,
  playerId: number,
  type: AgreementType,
): number {
  const player = game.players[playerId];
  if (
    type === "trade" &&
    factionRules(player) === "meridian" &&
    !player.diplomacy.firstTradeAgreementUsed
  )
    return policyCost(game, playerId, "agreement", { influence: 0 }).influence || 0;
  return policyCost(game, playerId, "agreement", { influence: Math.max(
    0,
    agreementRules[type].cost - (player.tech.Policy >= 4 ? 1 : 0),
  ) }).influence || 0;
}

export function addAgreementProposal(
  game: GameState,
  proposal: AgreementProposal,
): { ok: boolean; message: string } {
  const rule = agreementRules[proposal.agreementType];
  const from = game.players[proposal.from],
    to = game.players[proposal.to];
  if (from.tech.Policy < rule.policy || to.tech.Policy < rule.policy)
    return {
      ok: false,
      message: `Both parties require Policy ${rule.policy}.`,
    };
  if (hasAgreement(game, proposal.from, proposal.to, proposal.agreementType))
    return { ok: false, message: "That agreement is already active." };
  if (
    from.resources.influence <
    agreementCost(game, proposal.from, proposal.agreementType)
  )
    return { ok: false, message: "The proposer lacks the required Influence." };
  game.proposals.push(proposal);
  game.log.unshift(
    `${from.name} proposed a ${agreementNames[proposal.agreementType]} to ${to.name}.`,
  );
  return { ok: true, message: "Agreement proposal sent." };
}

function branchResource(
  branch: TechnologyBranch,
): TradableResource | "influence" {
  return branch === "Policy"
    ? "influence"
    : branch === "Military" || branch === "Resource"
      ? "material"
      : "currency";
}

export function researchAgreementDiscount(
  game: GameState,
  player: PlayerState,
): number {
  const active = activeAgreements(game).some(
    (agreement) =>
      agreement.type === "research" && agreement.parties.includes(player.id),
  );
  return active && !player.diplomacy.researchDiscountEras.includes(game.era)
    ? 1
    : 0;
}

export function technologyCost(
  game: GameState,
  playerId: number,
  branch: TechnologyBranch,
  level: number,
  exchange = false,
): Record<string, number> {
  const player = game.players[playerId];
  const [baseResearch, labor, branchCost] = technologyCosts[level];
  const exchangeResearch = exchange
    ? Math.ceil(baseResearch / 2)
    : baseResearch;
  const factionDiscount = !exchange && factionRules(player) === "helix" ? 1 : 0;
  const agreementDiscount = researchAgreementDiscount(game, player);
  return policyCost(game, playerId, "technology", {
    research: Math.max(
      1,
      exchangeResearch - factionDiscount - agreementDiscount,
    ),
    labor,
    [branchResource(branch)]: branchCost,
  });
}

function canPayRecord(
  player: PlayerState,
  cost: Record<string, number>,
): boolean {
  return Object.entries(cost).every(([key, value]) =>
    key === "labor"
      ? player.labor >= value
      : player.resources[key as keyof typeof player.resources] >= value,
  );
}

export function technologyExchangeCost(game: GameState, buyerId: number, branch: TechnologyBranch, level: number, compensation: Record<TradableResource, number>) {
  const cost = technologyCost(game, buyerId, branch, level, true);
  for (const resource of ["material", "currency", "research"] as const)
    cost[resource] = (cost[resource] || 0) + compensation[resource];
  return cost;
}

function payRecord(player: PlayerState, cost: Record<string, number>): void {
  Object.entries(cost).forEach(([key, value]) => {
    if (key === "labor") player.labor -= value;
    else player.resources[key as keyof typeof player.resources] -= value;
  });
}

export function addTechnologyProposal(
  game: GameState,
  proposal: TechnologyProposal,
): { ok: boolean; message: string } {
  const seller = game.players[proposal.seller],
    buyer = game.players[proposal.buyer];
  if (factionRules(seller) !== "helix")
    return {
      ok: false,
      message: "Only the Helix may offer Technology Exchange.",
    };
  const eligibility = tradeEligibility(game, proposal.seller, proposal.buyer);
  if (!eligibility.ok) return eligibility;
  if (
    seller.tech[proposal.branch] < proposal.level ||
    buyer.tech[proposal.branch] !== proposal.level - 1
  )
    return {
      ok: false,
      message:
        "The seller must own the level and the buyer must own the immediately preceding level.",
    };
  if (buyer.techAdvancedTurn === game.turn)
    return {
      ok: false,
      message: "The buyer already advanced Technology this Turn.",
    };
  const compensation = { ...proposal.compensation, labor: 0 } as TradeBundle;
  if (!canProvide(game, proposal.buyer, compensation))
    return {
      ok: false,
      message: "The buyer cannot currently provide the requested compensation.",
    };
  game.proposals.push(proposal);
  game.log.unshift(
    `${seller.name} offered ${proposal.branch} ${proposal.level} to ${buyer.name}.`,
  );
  return { ok: true, message: "Technology Exchange proposal sent." };
}

export function resolveProposal(
  game: GameState,
  proposalId: string,
  accept: boolean,
  blockadeDestinationHexId?: string,
): { ok: boolean; message: string } {
  const proposal = game.proposals.find((item) => item.id === proposalId);
  if (!proposal || proposal.status !== "pending")
    return { ok: false, message: "That proposal is no longer pending." };
  if (proposal.kind === "trade" && proposal.expiresAfterTurn !== undefined && proposal.expiresAfterTurn < game.turn) {
    proposal.status = "cancelled";
    return { ok: false, message: "That counteroffer expired at the end of its Turn." };
  }
  if (!accept) {
    proposal.status = "rejected";
    game.log.unshift(
      `${proposal.kind === "technology" ? game.players[proposal.buyer].name : game.players[proposal.to].name} rejected the proposal.`,
    );
    return { ok: true, message: "Proposal rejected." };
  }

  if (proposal.kind === "trade") {
    if (!validTradeBundle(proposal.offer) || !validTradeBundle(proposal.request))
      return { ok: false, message: "Trade quantities must be non-negative whole numbers up to 99." };
    const influenceEligibility = influenceTradeEligibility(game, proposal);
    if (!influenceEligibility.ok) return influenceEligibility;
    const assetEligibility = blockadeSaleEligibility(game, proposal);
    if (!assetEligibility.ok) return assetEligibility;
    const eligibility = proposal.blockadeId || proposal.blockadeCommission ? { ok: true, message: assetEligibility.message } : tradeEligibility(game, proposal.from, proposal.to);
    if (!eligibility.ok) return eligibility;
    if ((proposal.blockadeId || proposal.blockadeCommission) && (!blockadeDestinationHexId || !legalBlockadeSaleDestinations(game, proposal.to).some((hex) => hex.id === blockadeDestinationHexId)))
      return { ok: false, message: "Choose one of your controlled hexes for the purchased Blockade." };
    if (
      (proposal.offer.labor || proposal.request.labor) &&
      !hasBenefit(game, proposal.from, proposal.to, "trade")
    )
      return {
        ok: false,
        message: "Labor transfers still require a Trade Agreement or Alliance.",
      };
    if (
      !canProvide(game, proposal.from, proposal.offer) ||
      !canProvide(game, proposal.to, proposal.request) || proposal.blockadeCommission &&
      !canPayRecord(game.players[proposal.to], blockadeCommissionTotal(proposal.request))
    )
      return {
        ok: false,
        message: "One party can no longer provide the proposed resources.",
      };
    const sealed = game.orderProtocol.submissions.filter((submission) =>
      submission.playerId === proposal.from || submission.playerId === proposal.to);
    if (sealed.length) {
      const preview = structuredClone(game);
      transferBundle(preview, proposal.from, proposal.to, proposal.offer);
      transferBundle(preview, proposal.to, proposal.from, proposal.request);
      if (proposal.blockadeCommission) payRecord(preview.players[proposal.to], blockadeConstructionCost);
      if (sealed.some((submission) => projectedOrderBudget(preview, submission.playerId, submission.orders).error))
        return { ok: false, message: "This trade would consume resources committed to sealed Orders." };
    }
    transferBundle(game, proposal.from, proposal.to, proposal.offer);
    transferBundle(game, proposal.to, proposal.from, proposal.request);
    if (proposal.offer.influence) {
      const metrics = game.players[proposal.from].legacyMetrics;
      if (!(metrics.aurelianInfluenceTradePartners ||= []).includes(proposal.to)) metrics.aurelianInfluenceTradePartners.push(proposal.to);
    }
    if (proposal.request.influence) {
      const metrics = game.players[proposal.to].legacyMetrics;
      if (!(metrics.aurelianInfluenceTradePartners ||= []).includes(proposal.from)) metrics.aurelianInfluenceTradePartners.push(proposal.from);
    }
    if (proposal.blockadeCommission) {
      payRecord(game.players[proposal.to], blockadeConstructionCost);
      placeCommissionedBlockade(game, proposal.from, proposal.to, blockadeDestinationHexId!);
      game.players[proposal.from].legacyMetrics.aegisPlatformTransfers.push(proposal.to);
      game.players[proposal.to].legacyMetrics.aegisForeignBeneficiaries.push(proposal.from);
    }
    if (proposal.blockadeId) {
      placeSoldBlockade(game, proposal.blockadeId, proposal.to, blockadeDestinationHexId!);
      game.players[proposal.from].legacyMetrics.aegisPlatformTransfers.push(proposal.to);
      game.players[proposal.to].legacyMetrics.aegisForeignBeneficiaries.push(proposal.from);
    }
    const era = game.era - 1,
      from = game.players[proposal.from],
      to = game.players[proposal.to];
    if (!from.legacyMetrics.tradePartners[era].includes(to.id))
      from.legacyMetrics.tradePartners[era].push(to.id);
    if (!to.legacyMetrics.tradePartners[era].includes(from.id))
      to.legacyMetrics.tradePartners[era].push(from.id);
    from.legacyMetrics.tradeCount[era]++;
    to.legacyMetrics.tradeCount[era]++;
    if (bundleTotal(proposal.offer) > 0 && !from.legacyMetrics.givenTradePartners[era].includes(to.id)) from.legacyMetrics.givenTradePartners[era].push(to.id);
    if (bundleTotal(proposal.request) > 0 && !to.legacyMetrics.givenTradePartners[era].includes(from.id)) to.legacyMetrics.givenTradePartners[era].push(from.id);
    if (!from.legacyMetrics.directTradePartners.includes(to.id)) from.legacyMetrics.directTradePartners.push(to.id);
    if (!to.legacyMetrics.directTradePartners.includes(from.id)) to.legacyMetrics.directTradePartners.push(from.id);
    from.legacyMetrics.directTradeCount++;
    to.legacyMetrics.directTradeCount++;
    if (!proposal.blockadeCommission && !proposal.blockadeId) {
      if (activePolicy(game) === "open-markets" && !hasBenefit(game, from.id, to.id, "trade") && tradeEligibility(game, from.id, to.id).message.startsWith("Open Markets")) markPolicyUsed(game, from.id, "open-markets", "turn");
      if (activePolicy(game) === "open-commerce") for (const party of [from, to]) if (!policyUsed(game, party.id, "open-commerce", "turn")) {
        party.resources.currency++;
        markPolicyUsed(game, party.id, "open-commerce", "turn");
      }
    }
    const ordinary = (bundle: TradeBundle) =>
      bundle.material + bundle.currency + bundle.research;
    from.legacyMetrics.receivedTradeValue[era] +=
      ordinary(proposal.request) + proposal.request.labor * 3;
    to.legacyMetrics.receivedTradeValue[era] +=
      ordinary(proposal.offer) + proposal.offer.labor * 3;
    from.legacyMetrics.givenTradeResources[era] += ordinary(proposal.offer);
    to.legacyMetrics.givenTradeResources[era] += ordinary(proposal.request);
    from.legacyMetrics.givenResearch[era] += proposal.offer.research;
    to.legacyMetrics.givenResearch[era] += proposal.request.research;
    if (proposal.offer.labor || proposal.request.labor) {
      from.legacyMetrics.laborTraded[era]++;
      to.legacyMetrics.laborTraded[era]++;
    }
    for (const [aurelian, host] of [
      [from, to],
      [to, from],
    ] as [PlayerState, PlayerState][]) {
      const hosted =
        factionRules(aurelian) === "aurelians" &&
        game.civilianUnits.some(
          (unit) =>
            unit.owner === aurelian.id &&
            unit.type === "envoy" &&
            game.hexes.some(
              (hex) => hex.id === unit.hex && hex.owner === host.id && hex.tier,
            ),
        );
      if (hosted) {
        aurelian.resources.influence++;
        aurelian.diplomacy.bonusInfluenceGained =
          (aurelian.diplomacy.bonusInfluenceGained || 0) + 1;
        if (!aurelian.legacyMetrics.envoyHosts.includes(host.id))
          aurelian.legacyMetrics.envoyHosts.push(host.id);
        game.log.unshift(
          `${aurelian.name} gained 1 Influence from an Envoy-hosted trade.`,
        );
      }
    }
    establishContact(game, proposal.from, proposal.to);
    proposal.status = "accepted";
    game.log.unshift(proposal.blockadeCommission
      ? `${game.players[proposal.to].name} commissioned an Aegis Blockade Platform from ${game.players[proposal.from].name} and deployed it at ${blockadeDestinationHexId}.`
      : proposal.blockadeId
      ? `${game.players[proposal.to].name} purchased an Aegis Blockade Platform from ${game.players[proposal.from].name} and deployed it at ${blockadeDestinationHexId}.`
      : `${game.players[proposal.from].name} and ${game.players[proposal.to].name} completed a direct trade.`);
    return { ok: true, message: proposal.blockadeCommission ? "Blockade commission completed." : proposal.blockadeId ? "Blockade sale completed." : "Trade completed." };
  }

  if (proposal.kind === "agreement") {
    const rule = agreementRules[proposal.agreementType];
    const from = game.players[proposal.from],
      to = game.players[proposal.to];
    if (from.tech.Policy < rule.policy || to.tech.Policy < rule.policy)
      return {
        ok: false,
        message: `Both parties require Policy ${rule.policy}.`,
      };
    if (hasAgreement(game, proposal.from, proposal.to, proposal.agreementType))
      return { ok: false, message: "That agreement is already active." };
    const fromCost = agreementCost(game, proposal.from, proposal.agreementType),
      toCost = agreementCost(game, proposal.to, proposal.agreementType);
    if (from.resources.influence < fromCost || to.resources.influence < toCost)
      return {
        ok: false,
        message: "One party no longer has enough Influence.",
      };
    const sealed = game.orderProtocol.submissions.filter((submission) =>
      submission.playerId === from.id || submission.playerId === to.id);
    if (sealed.length) {
      const preview = structuredClone(game);
      for (const [party, partner, cost] of [[from, to, fromCost], [to, from, toCost]] as const) {
        const bonus = factionRules(party) === "aurelians" && !party.diplomacy.firstAgreementPartners.includes(partner.id) ? 1 : 0;
        preview.players[party.id].resources.influence -= cost - bonus;
      }
      if (sealed.some((submission) => projectedOrderBudget(preview, submission.playerId, submission.orders).error))
        return { ok: false, message: "This agreement would consume Influence committed to sealed Orders." };
    }
    from.resources.influence -= fromCost;
    to.resources.influence -= toCost;
    if (activePolicy(game) === "cultural-funding") {
      markPolicyUsed(game, from.id, "agreement");
      markPolicyUsed(game, to.id, "agreement");
    }
    if (proposal.agreementType === "trade") {
      if (
        factionRules(from) === "meridian" &&
        !from.diplomacy.firstTradeAgreementUsed
      )
        from.diplomacy.firstTradeAgreementUsed = true;
      if (factionRules(to) === "meridian" && !to.diplomacy.firstTradeAgreementUsed)
        to.diplomacy.firstTradeAgreementUsed = true;
    }
    ([from, to] as PlayerState[]).forEach((player, index) => {
      const partner = index === 0 ? to.id : from.id;
      if (
        factionRules(player) === "aurelians" &&
        !player.diplomacy.firstAgreementPartners.includes(partner)
      ) {
        player.diplomacy.firstAgreementPartners.push(partner);
        player.resources.influence += 1;
        player.diplomacy.bonusInfluenceGained =
          (player.diplomacy.bonusInfluenceGained || 0) + 1;
      }
      if (
        !player.legacyMetrics.agreementsEstablished[game.era - 1].includes(
          partner,
        )
      )
        player.legacyMetrics.agreementsEstablished[game.era - 1].push(partner);
    });
    game.agreements.push({
      id: `agreement-${proposal.id}`,
      type: proposal.agreementType,
      parties: [proposal.from, proposal.to],
      startedTurn: game.turn,
    });
    proposal.status = "accepted";
    establishContact(game, proposal.from, proposal.to);
    game.log.unshift(
      `${from.name} and ${to.name} established a ${agreementNames[proposal.agreementType]}.`,
    );
    return { ok: true, message: "Agreement established." };
  }

  const seller = game.players[proposal.seller],
    buyer = game.players[proposal.buyer];
  const eligibility = tradeEligibility(game, proposal.seller, proposal.buyer);
  if (!eligibility.ok) return eligibility;
  if (
    buyer.techAdvancedTurn === game.turn ||
    buyer.tech[proposal.branch] !== proposal.level - 1 ||
    seller.tech[proposal.branch] < proposal.level
  )
    return {
      ok: false,
      message: "Technology eligibility changed before acceptance.",
    };
  const cost = technologyCost(
    game,
    buyer.id,
    proposal.branch,
    proposal.level,
    true,
  );
  const compensation = { ...proposal.compensation, labor: 0 } as TradeBundle;
  const combinedCost = technologyExchangeCost(game, buyer.id, proposal.branch, proposal.level, proposal.compensation);
  if (!canPayRecord(buyer, combinedCost))
    return {
      ok: false,
      message: "The buyer cannot afford the Technology and compensation.",
    };
  payRecord(buyer, cost);
  transferBundle(game, buyer.id, seller.id, compensation);
  buyer.tech[proposal.branch] = proposal.level;
  buyer.legacyMetrics.technologyAdvances[game.era - 1].push(proposal.branch);
  buyer.techAdvancedTurn = game.turn;
  if (researchAgreementDiscount(game, buyer))
    buyer.diplomacy.researchDiscountEras.push(game.era);
  if (!seller.diplomacy.technologyExportPartners.includes(buyer.id))
    seller.diplomacy.technologyExportPartners.push(buyer.id);
  proposal.status = "accepted";
  game.log.unshift(
    `${buyer.name} acquired ${proposal.branch} ${proposal.level} from ${seller.name}.`,
  );
  return { ok: true, message: "Technology Exchange completed." };
}

export function cancelProposal(
  game: GameState,
  proposalId: string,
  playerId: number,
): boolean {
  const proposal = game.proposals.find((item) => item.id === proposalId);
  const proposer =
    proposal?.kind === "technology" ? proposal.seller : proposal?.from;
  if (!proposal || proposal.status !== "pending" || proposer !== playerId)
    return false;
  proposal.status = "cancelled";
  return true;
}

export function scheduleWithdrawal(
  game: GameState,
  agreementId: string,
  playerId: number,
): { ok: boolean; message: string } {
  const agreement = game.agreements.find(
    (item) => item.id === agreementId && item.parties.includes(playerId),
  );
  if (!agreement) return { ok: false, message: "Agreement not found." };
  agreement.endsAfterTurn = game.turn;
  game.log.unshift(
    `${game.players[playerId].name} announced withdrawal from ${agreementNames[agreement.type]}; it ends next Turn.`,
  );
  return { ok: true, message: "Withdrawal scheduled for the next Turn." };
}

export function breakAgreement(
  game: GameState,
  agreementId: string,
  playerId: number,
): { ok: boolean; message: string } {
  const index = game.agreements.findIndex(
    (item) => item.id === agreementId && item.parties.includes(playerId),
  );
  if (index < 0) return { ok: false, message: "Agreement not found." };
  const player = game.players[playerId];
  if (player.resources.influence < 2)
    return { ok: false, message: "Immediate breaking requires 2 Influence." };
  const [agreement] = game.agreements.splice(index, 1);
  player.resources.influence -= 2;
  player.lp = Math.max(0, player.lp - 2);
  game.log.unshift(
    `${player.name} immediately broke ${agreementNames[agreement.type]}, paying 2 Influence and losing 2 LP.`,
  );
  return { ok: true, message: "Agreement broken immediately." };
}

export function processNewTurnDiplomacy(
  game: GameState,
  newTurn: number,
): void {
  for (const proposal of game.proposals) {
    if (proposal.kind === "trade" && proposal.status === "pending" &&
        proposal.expiresAfterTurn !== undefined && proposal.expiresAfterTurn < newTurn)
      proposal.status = "cancelled";
  }
  game.agreements = game.agreements.filter(
    (agreement) =>
      agreement.endsAfterTurn === undefined ||
      agreement.endsAfterTurn >= newTurn,
  );
  const changes = game.pendingLabor.filter(
    (change) => change.effectiveTurn <= newTurn,
  );
  changes.forEach((change) => {
    const player = game.players[change.playerId];
    player.laborBonus = Math.max(-2, player.laborBonus + change.amount);
    player.laborCap = Math.max(1, player.laborCap + change.amount);
    player.labor = Math.min(player.labor, player.laborCap);
  });
  game.pendingLabor = game.pendingLabor.filter(
    (change) => change.effectiveTurn > newTurn,
  );
}

export function politicalCapital(
  game: GameState,
  playerId: number,
  output: "currency" | "material" | "labor",
): { ok: boolean; message: string } {
  const player = game.players[playerId];
  if (factionRules(player) !== "aurelians" || player.tech.Policy < 2)
    return {
      ok: false,
      message: "Political Capital requires the Aurelians at Policy II.",
    };
  const cost = output === "labor" ? 4 : 2;
  if (player.resources.influence < cost)
    return {
      ok: false,
      message: `Political Capital requires ${cost} Influence.`,
    };
  if (
    output === "labor" &&
    player.diplomacy.politicalLaborEras.includes(game.era)
  )
    return {
      ok: false,
      message: "Permanent Labor may be created only once per Era.",
    };
  player.resources.influence -= cost;
  if (output === "labor") {
    player.laborBonus += 1;
    player.laborCap += 1;
    player.labor += 1;
    player.diplomacy.politicalLaborEras.push(game.era);
  } else player.resources[output] += 1;
  game.log.unshift(
    `${player.name} converted Political Capital into ${output === "labor" ? "1 permanent Labor Capacity" : `1 ${output}`}.`,
  );
  return { ok: true, message: "Political Capital converted." };
}

export function pendingFor(
  game: GameState,
  playerId: number,
): DiplomacyProposal[] {
  return game.proposals.filter(
    (proposal) =>
      proposal.status === "pending" &&
      (proposal.kind === "technology"
        ? proposal.buyer === playerId
        : proposal.to === playerId),
  );
}
