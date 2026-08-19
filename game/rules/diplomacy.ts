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
import { technologyCosts } from "./economy";

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
      "Records permission for co-stationed defense; combined combat remains table-managed.",
  },
  alliance: {
    policy: 3,
    cost: 3,
    effect:
      "Includes Trade, Open Borders, Defensive Pact, and non-hostility benefits.",
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
        game.players[a].colonyShip,
        ...game.carriers
          .filter((carrier) => carrier.owner === a)
          .map((carrier) => carrier.hex),
        ...game.civilianUnits.filter((unit) => unit.owner === a).map((unit) => unit.hex),
      ];
      const vesselsB = [
        game.players[b].explorer,
        game.players[b].colonyShip,
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
  Object.values(bundle).reduce((sum, amount) => sum + amount, 0);

function availableLabor(game: GameState, playerId: number): number {
  const committed = game.pendingLabor
    .filter((change) => change.playerId === playerId && change.amount < 0)
    .reduce((sum, change) => sum - change.amount, 0);
  return Math.max(0, game.players[playerId].laborCap - 1 - committed);
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
  const eligibility = tradeEligibility(game, proposal.from, proposal.to);
  if (!eligibility.ok) return eligibility;
  if (!bundleTotal(proposal.offer) && !bundleTotal(proposal.request))
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
  establishContact(game, proposal.from, proposal.to);
  game.proposals.push(proposal);
  game.log.unshift(
    `${game.players[proposal.from].name} sent a direct-trade proposal to ${game.players[proposal.to].name}.`,
  );
  return { ok: true, message: "Trade proposal sent." };
}

export function agreementCost(
  game: GameState,
  playerId: number,
  type: AgreementType,
): number {
  const player = game.players[playerId];
  if (
    type === "trade" &&
    player.faction === "meridian" &&
    !player.diplomacy.firstTradeAgreementUsed
  )
    return 0;
  return Math.max(
    0,
    agreementRules[type].cost - (player.tech.Policy >= 4 ? 1 : 0),
  );
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
  const factionDiscount = !exchange && player.faction === "helix" ? 1 : 0;
  const agreementDiscount = researchAgreementDiscount(game, player);
  return {
    research: Math.max(
      1,
      exchangeResearch - factionDiscount - agreementDiscount,
    ),
    labor,
    [branchResource(branch)]: branchCost,
  };
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
  if (seller.faction !== "helix")
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
): { ok: boolean; message: string } {
  const proposal = game.proposals.find((item) => item.id === proposalId);
  if (!proposal || proposal.status !== "pending")
    return { ok: false, message: "That proposal is no longer pending." };
  if (!accept) {
    proposal.status = "rejected";
    game.log.unshift(
      `${proposal.kind === "technology" ? game.players[proposal.buyer].name : game.players[proposal.to].name} rejected the proposal.`,
    );
    return { ok: true, message: "Proposal rejected." };
  }

  if (proposal.kind === "trade") {
    const eligibility = tradeEligibility(game, proposal.from, proposal.to);
    if (!eligibility.ok) return eligibility;
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
      !canProvide(game, proposal.to, proposal.request)
    )
      return {
        ok: false,
        message: "One party can no longer provide the proposed resources.",
      };
    transferBundle(game, proposal.from, proposal.to, proposal.offer);
    transferBundle(game, proposal.to, proposal.from, proposal.request);
    const era = game.era - 1,
      from = game.players[proposal.from],
      to = game.players[proposal.to];
    if (!from.legacyMetrics.tradePartners[era].includes(to.id))
      from.legacyMetrics.tradePartners[era].push(to.id);
    if (!to.legacyMetrics.tradePartners[era].includes(from.id))
      to.legacyMetrics.tradePartners[era].push(from.id);
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
        aurelian.faction === "aurelians" &&
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
    game.log.unshift(
      `${game.players[proposal.from].name} and ${game.players[proposal.to].name} completed a direct trade.`,
    );
    return { ok: true, message: "Trade completed." };
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
    from.resources.influence -= fromCost;
    to.resources.influence -= toCost;
    if (proposal.agreementType === "trade") {
      if (
        from.faction === "meridian" &&
        !from.diplomacy.firstTradeAgreementUsed
      )
        from.diplomacy.firstTradeAgreementUsed = true;
      if (to.faction === "meridian" && !to.diplomacy.firstTradeAgreementUsed)
        to.diplomacy.firstTradeAgreementUsed = true;
    }
    ([from, to] as PlayerState[]).forEach((player, index) => {
      const partner = index === 0 ? to.id : from.id;
      if (
        player.faction === "aurelians" &&
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
  if (!canPayRecord(buyer, cost) || !canProvide(game, buyer.id, compensation))
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
  if (player.faction !== "aurelians" || player.tech.Policy < 2)
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
