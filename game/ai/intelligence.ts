import { getNeighbors } from "../engine/geometry";
import { mapLibrary } from "../maps";
import { projectPrivateGame } from "../server/private-view";
import type {
  CenterType,
  GameState,
  HexState,
  PlayerState,
  Resource,
  SecretOrder,
  TechnologyBranch,
  TradeBundle,
} from "../types";
import {
  addAgreementProposal,
  addTechnologyProposal,
  addTradeProposal,
  agreementCost,
  emptyTradeBundle,
  isContacted,
  politicalCapital,
  resolveProposal,
  tradeEligibility,
  technologyCost,
} from "../rules/diplomacy";
import { availableCivilianType, brokerTrade, economicSalvage, surveyExchange } from "../rules/faction-operations";
import {
  availableCarrierTypes,
  carrierLibrary,
  removeCapturedCenter,
  totalCombatUnits,
} from "../rules/fleet";
import {
  drawHiddenChoices,
  hiddenLegacyDeck,
  legacyObjectiveProgress,
  selectHiddenLegacy,
} from "../rules/legacy";
import { orderLabel, submitSecretOrders } from "../rules/orders";
import {
  constructionQuote,
  projectedOrderBudget,
  technologyQuote,
} from "../rules/purchases";
import { hasBenefit } from "../rules/diplomacy";
import { canPay, marketExchange, marketRate, tributeCosts } from "../rules/economy";
import type {
  BotCandidate,
  BotCommitment,
  BotDecisionReport,
  BotMemoryState,
  BotOrderAssessment,
  BotProfile,
  BotStrategicPlan,
  BotTurnPlan,
} from "./types";
import { classifyOpponent, createStrategicPlan, strategicOrderModifier } from "./strategy";

const branches: TechnologyBranch[] = ["Military", "Economy", "Policy", "Exploration", "Resource"];
const centers: CenterType[] = ["material", "currency", "research", "influence", "labor", "defense"];
const economicKinds = ["material", "currency", "research", "influence", "labor"];

function stableNoise(seed: number, key: string) {
  let hash = seed || 1;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return (hash % 1000) / 100000;
}

function bundleValue(player: PlayerState, bundle: TradeBundle) {
  const scarcity = (resource: Resource) => 1 + Math.max(0, 3 - player.resources[resource]) * 0.22;
  return bundle.material * scarcity("material") +
    bundle.currency * scarcity("currency") +
    bundle.research * scarcity("research") * 1.15 +
    bundle.labor * 2.35;
}

function updateBotMemory(game: GameState, playerId: number, profile: BotProfile) {
  const privateGame = projectPrivateGame(game, playerId);
  const previous = game.botMemory.find((memory) => memory.playerId === playerId);
  const priorHistory = [...privateGame.history].filter((point) => point.turn < privateGame.turn).at(-1);
  const rawOpponents = privateGame.players.filter((player) => player.id !== playerId).map((player) => {
    const old = previous?.opponents.find((model) => model.playerId === player.id);
    const priorLP = priorHistory?.players.find((entry) => entry.playerId === player.id)?.lp ?? old?.lp ?? player.lp;
    const proposals = privateGame.proposals.filter((proposal) => proposal.kind !== "technology" &&
      (proposal.from === player.id || proposal.to === player.id));
    const accepted = proposals.filter((proposal) => proposal.status === "accepted").length;
    return {
      playerId: player.id,
      observedTurn: privateGame.turn,
      lp: player.lp,
      lpTrend: player.lp - priorLP,
      military: totalCombatUnits(privateGame, player.id),
      habitats: privateGame.hexes.filter((hex) => hex.owner === player.id && hex.tier).length,
      tributes: player.tributes,
      aggression: player.legacyMetrics.combatInitiated.reduce((sum, value) => sum + value, 0),
      tradeReliability: proposals.length ? accepted / proposals.length : 0.5,
      gateReliability: Math.min(1, player.tributes / Math.max(1, Math.min(3, privateGame.era))),
    };
  });
  const averageMilitary = privateGame.players.reduce((sum, player) => sum + totalCombatUnits(privateGame, player.id), 0) / privateGame.players.length;
  const averageHabitats = privateGame.players.reduce((sum, player) => sum + privateGame.hexes.filter((hex) => hex.owner === player.id && hex.tier).length, 0) / privateGame.players.length;
  const leaderLP = Math.max(...privateGame.players.map((player) => player.lp));
  const opponents = rawOpponents.map((model) => ({ ...model, archetypes: classifyOpponent(model, averageMilitary, averageHabitats, privateGame.era, leaderLP) }));
  const target = privateGame.players.length * 3, turnsRemaining = 17 - privateGame.turn;
  const metaFlags: string[] = [];
  if (profile.behaviors.redTeamNotebook && target - privateGame.gate > turnsRemaining) metaFlags.push("GATE RANSOM RISK: required Tribute pace now exceeds one per remaining Turn.");
  const leaders = [...privateGame.players].sort((a, b) => b.lp - a.lp);
  if (profile.behaviors.redTeamNotebook && (leaders[0]?.lp || 0) - (leaders[1]?.lp || 0) >= 4) metaFlags.push(`RUNAWAY LEADER: ${leaders[0].name} leads by at least 4 LP.`);
  const currencyTotal = privateGame.players.reduce((sum, player) => sum + player.resources.currency, 0);
  if (profile.behaviors.redTeamNotebook && currencyTotal < privateGame.players.length) metaFlags.push("RESOURCE BOTTLENECK: public Currency reserves are below one per civilization.");
  const commitments = (previous?.commitments || []).map((commitment) => {
    const completed = privateGame.proposals.some((proposal) => proposal.status === "accepted" &&
      proposal.createdTurn >= commitment.createdTurn &&
      (proposal.kind === "technology"
        ? [proposal.seller, proposal.buyer].includes(commitment.partnerId)
        : [proposal.from, proposal.to].includes(commitment.partnerId)));
    return {
      ...commitment,
      status: completed ? "completed" as const :
        commitment.status !== "completed" && privateGame.turn > commitment.expiresTurn ? "expired" as const : commitment.status,
    };
  }).slice(-12);
  const memory: BotMemoryState = { playerId, updatedTurn: privateGame.turn, opponents, commitments, metaFlags };
  memory.strategy = createStrategicPlan(privateGame, playerId, profile);
  if (memory.strategy.gateEmergency) metaFlags.push(`GATE EMERGENCY: projected completion confidence is ${Math.round(memory.strategy.gateConfidence * 100)}%.`);
  const index = game.botMemory.findIndex((entry) => entry.playerId === playerId);
  if (index >= 0) game.botMemory[index] = memory;
  else game.botMemory.push(memory);
  return memory;
}

function rememberCommitment(memory: BotMemoryState, commitment: BotCommitment) {
  memory.commitments.push(commitment);
  memory.commitments = memory.commitments.slice(-12);
}

function reviewDiplomacy(game: GameState, playerId: number, profile: BotProfile, memory: BotMemoryState) {
  const player = game.players[playerId], decisions: string[] = [];
  const incoming = game.proposals.filter((proposal) => proposal.status === "pending" &&
    (proposal.kind === "technology" ? proposal.buyer === playerId : proposal.to === playerId));
  for (const proposal of incoming) {
    let accept = false, reason = "terms did not clear the strategic threshold";
    if (proposal.kind === "trade") {
      const received = bundleValue(player, proposal.offer), paid = bundleValue(player, proposal.request);
      const gateNeed = memory.strategy?.priorityResources.some((resource) => proposal.offer[resource as keyof TradeBundle] > 0) || false;
      accept = received >= paid * (gateNeed && memory.strategy?.gateEmergency ? .74 : 0.92 + profile.planning.riskTolerance * 0.12);
      reason = accept ? `received value ${received.toFixed(1)} exceeded paid value ${paid.toFixed(1)}` : `paid value ${paid.toFixed(1)} exceeded received value ${received.toFixed(1)}`;
    } else if (proposal.kind === "technology") {
      const compensation = proposal.compensation.material + proposal.compensation.currency + proposal.compensation.research * 1.15;
      const strategicValue = (5 - player.tech[proposal.branch]) * profile.technology[proposal.branch] * 2.6;
      accept = strategicValue >= compensation && player.techAdvancedTurn !== game.turn;
      reason = accept ? `${proposal.branch} advancement value exceeded compensation` : "Technology timing or compensation was inefficient";
    } else {
      const proposer = game.players[proposal.from], ownStrength = totalCombatUnits(game, playerId), theirStrength = totalCombatUnits(game, proposer.id);
      const useful = proposal.agreementType === "trade" || proposal.agreementType === "research" ||
        proposal.agreementType === "nonAggression" || player.faction === "aurelians" || player.faction === "meridian";
      const defensiveNeed = theirStrength >= ownStrength || player.lp < Math.max(...game.players.map((candidate) => candidate.lp));
      const cost = agreementCost(game, playerId, proposal.agreementType);
      accept = player.resources.influence >= cost && (useful || defensiveNeed);
      reason = accept ? "agreement improved access, safety, or Legacy position" : "Influence was more valuable in reserve";
    }
    const result = resolveProposal(game, proposal.id, accept);
    decisions.push(`${accept ? "Accepted" : "Rejected"} ${proposal.kind} proposal: ${reason}${result.ok ? "" : `; resolution failed: ${result.message}`}.`);
  }
  return decisions;
}

function initiateDiplomacy(game: GameState, playerId: number, profile: BotProfile, memory: BotMemoryState) {
  const player = game.players[playerId], decisions: string[] = [];
  if (game.proposals.some((proposal) => proposal.status === "pending" &&
      (proposal.kind === "technology" ? proposal.seller === playerId : proposal.from === playerId))) return decisions;
  const tradable = ["material", "currency", "research"] as const;
  const cost = tributeCosts[game.era];
  const needs = tradable.filter((resource) => player.resources[resource] < (cost[resource] || 0));
  const offers = tradable
    .filter((resource) => player.resources[resource] > Math.max(1, cost[resource] || 0))
    .sort((a, b) => player.resources[b] - player.resources[a]);
  if (player.faction === "helix") {
    const exchange = game.players.filter((candidate) => candidate.id !== playerId)
      .flatMap((buyer) => branches.filter((branch) => player.tech[branch] === buyer.tech[branch] + 1 &&
        buyer.techAdvancedTurn !== game.turn && tradeEligibility(game, playerId, buyer.id).ok)
        .map((branch) => ({ buyer, branch, cost: technologyCost(game, buyer.id, branch, buyer.tech[branch] + 1, true) })))
      .filter((entry) => canPay(entry.buyer, entry.cost))
      .sort((a, b) => (memory.strategy?.priorityResources.includes(a.branch === "Military" || a.branch === "Resource" ? "material" : "currency") ? -1 : 0) -
        (memory.strategy?.priorityResources.includes(b.branch === "Military" || b.branch === "Resource" ? "material" : "currency") ? -1 : 0) || a.buyer.id - b.buyer.id)[0];
    if (exchange) {
      const result = addTechnologyProposal(game, {
        id: `bot-tech-exchange-${game.turn}-${playerId}-${exchange.buyer.id}-${exchange.branch}`,
        kind: "technology", seller: playerId, buyer: exchange.buyer.id, branch: exchange.branch,
        level: exchange.buyer.tech[exchange.branch] + 1, compensation: { material: 0, currency: 0, research: 0 },
        createdTurn: game.turn, status: "pending",
      });
      if (result.ok) {
        decisions.push(`Offered ${exchange.branch} Technology to ${exchange.buyer.name} to improve coalition capacity.`);
        return decisions;
      }
    }
  }
  if (profile.behaviors.coordinateGateSupport) {
    const support = game.players
      .filter((candidate) => candidate.id !== playerId && !candidate.eraTributes[game.era - 1])
      .map((partner) => {
        const missing = tradable.filter((resource) => partner.resources[resource] < (cost[resource] || 0));
        const model = memory.opponents.find((entry) => entry.playerId === partner.id);
        return { partner, missing, reliability: model?.gateReliability || 0 };
      })
      .filter((entry) => entry.missing.length > 0 && tradeEligibility(game, playerId, entry.partner.id).ok)
      .map((entry) => ({ ...entry, resource: entry.missing.find((resource) => player.resources[resource] > (cost[resource] || 0) + profile.planning.gateSafetyMargin) }))
      .filter((entry): entry is typeof entry & { resource: typeof tradable[number] } => !!entry.resource)
      .sort((a, b) => a.missing.length - b.missing.length || a.partner.tributes - b.partner.tributes || b.reliability - a.reliability || a.partner.id - b.partner.id)[0];
    if (support) {
      const offered = emptyTradeBundle(), requested = emptyTradeBundle(), resource = support.resource;
      offered[resource] = 1;
      const result = addTradeProposal(game, {
        id: `bot-gate-support-${game.turn}-${playerId}-${support.partner.id}-${resource}`,
        kind: "trade", from: playerId, to: support.partner.id, offer: offered, request: requested,
        createdTurn: game.turn, status: "pending",
      });
      if (result.ok) {
        const detail = `1 ${resource} routed to ${support.partner.name} to complete its current Tribute cost`;
        rememberCommitment(memory, { partnerId: support.partner.id, createdTurn: game.turn,
          expiresTurn: game.turn + profile.planning.diplomacyHorizon, purpose: "gate-support", detail, status: "offered" });
        decisions.push(`Gate support offered: ${detail}.`);
        return decisions;
      }
    }
  }
  for (const need of needs) {
    for (const offer of offers) {
      const partners = game.players
        .filter((candidate) => candidate.id !== playerId && candidate.resources[need] > Math.max(1, cost[need] || 0))
        .filter((candidate) => candidate.resources[offer] < Math.max(1, cost[offer] || 0))
        .filter((candidate) => tradeEligibility(game, playerId, candidate.id).ok)
        .sort((a, b) => b.resources[need] - a.resources[need] || a.id - b.id);
      const partner = partners[0];
      if (!partner) continue;
      const offered = emptyTradeBundle(), requested = emptyTradeBundle();
      offered[offer] = 1;
      requested[need] = 1;
      const result = addTradeProposal(game, {
        id: `bot-trade-${game.turn}-${playerId}-${partner.id}-${offer}-${need}`,
        kind: "trade",
        from: playerId,
        to: partner.id,
        offer: offered,
        request: requested,
        createdTurn: game.turn,
        status: "pending",
      });
      if (result.ok) {
        rememberCommitment(memory, { partnerId: partner.id, createdTurn: game.turn,
          expiresTurn: game.turn + profile.planning.diplomacyHorizon, purpose: "resource-route",
          detail: `Exchange ${offer} for ${need}`, status: "offered" });
        decisions.push(`Proposed 1 ${offer} for 1 ${need} to ${partner.name}; this closes a Gate-cost deficit for both sides.`);
        return decisions;
      }
    }
  }
  if (needs.length && player.laborCap > 1) {
    const laborRoute = needs.flatMap((need) => game.players
      .filter((candidate) => candidate.id !== playerId && hasBenefit(game, playerId, candidate.id, "trade"))
      .filter((candidate) => candidate.resources[need] > Math.max(1, cost[need] || 0))
      .map((partner) => ({ need, partner })))
      .sort((a, b) => (b.partner.resources[b.need] - (cost[b.need] || 0)) -
        (a.partner.resources[a.need] - (cost[a.need] || 0)) || a.partner.id - b.partner.id)[0];
    if (laborRoute) {
      const offered = emptyTradeBundle(), requested = emptyTradeBundle();
      offered.labor = 1;
      requested[laborRoute.need] = 1;
      const result = addTradeProposal(game, {
        id: `bot-labor-route-${game.turn}-${playerId}-${laborRoute.partner.id}-${laborRoute.need}`,
        kind: "trade", from: playerId, to: laborRoute.partner.id, offer: offered, request: requested,
        createdTurn: game.turn, status: "pending",
      });
      if (result.ok) {
        const detail = `Exchange future Labor for ${laborRoute.need} through the Trade Agreement with ${laborRoute.partner.name}`;
        rememberCommitment(memory, { partnerId: laborRoute.partner.id, createdTurn: game.turn,
          expiresTurn: game.turn + profile.planning.diplomacyHorizon, purpose: "resource-route", detail, status: "offered" });
        decisions.push(`${detail}; the resource closes a Gate-cost deficit.`);
        return decisions;
      }
    }
  }
  const agreementPartner = game.players
    .filter((candidate) => candidate.id !== playerId && isContacted(game, playerId, candidate.id))
    .filter((candidate) => !hasBenefit(game, playerId, candidate.id, "trade"))
    .filter((candidate) => candidate.resources.influence > 0)
    .map((candidate) => ({
      candidate,
      complement: needs.reduce((sum, resource) => sum + Math.max(0, candidate.resources[resource] - (cost[resource] || 0)), 0) +
        offers.reduce((sum, resource) => sum + Math.max(0, (cost[resource] || 0) - candidate.resources[resource]), 0),
    }))
    .filter((entry) => entry.complement > 0 || player.faction === "aurelians")
    .sort((a, b) => b.complement - a.complement || a.candidate.id - b.candidate.id)[0]?.candidate;
  if (agreementPartner && player.resources.influence > 0 && profile.priorities.diplomacy > 0) {
    const result = addAgreementProposal(game, {
      id: `bot-trade-agreement-${game.turn}-${playerId}-${agreementPartner.id}`,
      kind: "agreement",
      from: playerId,
      to: agreementPartner.id,
      agreementType: "trade",
      createdTurn: game.turn,
      status: "pending",
    });
    if (result.ok) decisions.push(`Proposed a Trade Agreement to ${agreementPartner.name} to unlock future resource balancing.`);
    if (result.ok) rememberCommitment(memory, { partnerId: agreementPartner.id, createdTurn: game.turn,
      expiresTurn: game.turn + profile.planning.diplomacyHorizon, purpose: "trade-network",
      detail: `Open a permanent resource route with ${agreementPartner.name}`, status: "offered" });
  }
  return decisions;
}

function executeFactionEconomy(game: GameState, playerId: number, profile: BotProfile, plan: BotStrategicPlan) {
  const player = game.players[playerId], actions: string[] = [];
  if (!profile.behaviors.factionDoctrine) return actions;
  if (player.faction === "aurelians" && !player.eraTributes[game.era - 1]) {
    for (let attempt = 0; attempt < 3 && !canPay(player, tributeCosts[game.era]); attempt++) {
      const output = (["material", "currency"] as const).find((resource) => player.resources[resource] < (tributeCosts[game.era][resource] || 0));
      if (!output) break;
      const preserve = plan.gateEmergency ? 0 : 1;
      if (player.resources.influence - preserve < 2) break;
      const result = politicalCapital(game, playerId, output);
      if (!result.ok) break;
      actions.push(`Faction doctrine: converted Political Capital into ${output} for the Gate schedule.`);
    }
  }
  if (player.faction === "meridian" && plan.gateEmergency && player.resources.currency < (tributeCosts[game.era].currency || 0)) {
    const stationed = game.hexes.filter((hex) => hex.owner === playerId).reduce((sum, hex) => sum + hex.combat, 0);
    if (stationed >= 8) {
      const result = economicSalvage(game, playerId);
      if (result.ok) actions.push("Faction doctrine: converted surplus stationed CU into emergency Currency.");
    }
  }
  if (player.faction === "meridian") {
    const others = game.players.filter((candidate) => candidate.id !== playerId);
    outer: for (let aIndex = 0; aIndex < others.length; aIndex++) for (let bIndex = aIndex + 1; bIndex < others.length; bIndex++) {
      const a = others[aIndex], b = others[bIndex], cost = tributeCosts[game.era];
      for (const aResource of ["material", "currency", "research"] as const) for (const bResource of ["material", "currency", "research"] as const) {
        if (aResource === bResource || a.resources[aResource] <= (cost[aResource] || 0) || b.resources[bResource] <= (cost[bResource] || 0) ||
            a.resources[bResource] >= (cost[bResource] || 0) || b.resources[aResource] >= (cost[aResource] || 0)) continue;
        const aGives = emptyTradeBundle(), bGives = emptyTradeBundle();
        aGives[aResource] = 1; bGives[bResource] = 1;
        const result = brokerTrade(game, playerId, a.id, b.id, aGives, bGives);
        if (result.ok) {
          actions.push(`Faction doctrine: brokered ${aResource} for ${bResource} between ${a.name} and ${b.name}, closing two coalition deficits.`);
          break outer;
        }
      }
    }
  }
  if (player.faction === "farbound" && player.tech.Policy >= 2) {
    const survey = player.privateSurveys.find((entry) => !game.hexes.find((hex) => hex.id === entry.hexId)?.revealed && entry.soldTo.length < game.players.length - 1);
    const buyer = game.players.filter((candidate) => candidate.id !== playerId && !survey?.soldTo.includes(candidate.id) && candidate.resources.currency > (tributeCosts[game.era].currency || 0))
      .filter((candidate) => candidate.id !== plan.leaderId || plan.victoryPressure < 3)
      .sort((a, b) => b.resources.currency - a.resources.currency || a.id - b.id)[0];
    if (survey && buyer) {
      const result = surveyExchange(game, playerId, buyer.id, survey.hexId, 1);
      if (result.ok) actions.push(`Faction doctrine: sold one private survey to ${buyer.name}, creating flexible Currency without aiding a runaway leader.`);
    }
  }
  return actions;
}

function balanceGateViaMarket(game: GameState, playerId: number, profile: BotProfile) {
  if (!profile.behaviors.useMarketForGate) return [] as string[];
  const player = game.players[playerId], cost = tributeCosts[game.era], actions: string[] = [];
  if (player.eraTributes[game.era - 1] || canPay(player, cost)) return actions;
  for (let attempt = 0; attempt < 4 && !canPay(player, cost); attempt++) {
    const missing = (["material", "currency", "research"] as Resource[])
      .find((resource) => player.resources[resource] < (cost[resource] || 0));
    if (!missing) break;
    const source = (["currency", "material", "research"] as Resource[])
      .filter((resource) => resource !== missing)
      .map((resource) => ({ resource, rate: marketRate(player, resource, missing) }))
      .filter((entry): entry is { resource: Resource; rate: number } => !!entry.rate)
      .filter((entry) => player.resources[entry.resource] >= entry.rate + (cost[entry.resource] || 0))
      .sort((a, b) => player.resources[b.resource] - b.rate - (player.resources[a.resource] - a.rate))[0];
    if (!source) break;
    const result = marketExchange(game, playerId, source.resource, missing);
    if (!result.ok) break;
    actions.push(`Market conversion: ${result.message} This closes the current Gate ledger deficit.`);
  }
  return actions;
}

function objectiveAffinity(player: PlayerState, condition: string) {
  const text = condition.toLowerCase();
  let score = 0;
  if (text.includes("technology")) score += player.faction === "helix" ? 18 : 7;
  if (text.includes("habitat") || text.includes("colon")) score += ["foundry", "farbound"].includes(player.faction) ? 17 : 8;
  if (text.includes("trade") || text.includes("agreement")) score += ["aurelians", "meridian"].includes(player.faction) ? 19 : 5;
  if (text.includes("combat") || text.includes("capture") || text.includes("cu")) score += player.faction === "varkesh" ? 20 : 4;
  if (text.includes("tribute")) score += 8;
  if (text.includes("survey") || text.includes("reveal")) score += player.faction === "farbound" ? 20 : 8;
  if (text.includes("center") || text.includes("produce")) score += player.faction === "foundry" ? 17 : 7;
  return score;
}

function chooseHiddenObjective(game: GameState, playerId: number, profile: BotProfile) {
  drawHiddenChoices(game, playerId, game.era);
  const state = game.players[playerId].hiddenLegacy[game.era];
  if (state.selected) return { id: state.selected, reason: "Previously selected for this Era." };
  const privateGame = projectPrivateGame(game, playerId), player = privateGame.players[playerId];
  const ranked = state.choices.map((id) => {
    const card = hiddenLegacyDeck.find((candidate) => candidate.id === id)!;
    const progress = legacyObjectiveProgress(privateGame, playerId, id);
    const completion = progress.target ? progress.current / progress.target : 0;
    const manualPenalty = card.automatic ? 0 : 13;
    const score = card.lp * 8 * profile.priorities.legacy + completion * 32 + objectiveAffinity(player, card.condition) - manualPenalty;
    return { card, score };
  }).sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));
  const selected = ranked[0];
  selectHiddenLegacy(game, playerId, selected.card.id);
  return {
    id: selected.card.id,
    reason: `${selected.card.lp} LP, faction affinity, current progress, and estimated Era feasibility produced score ${selected.score.toFixed(1)}.`,
  };
}

function reachableThreats(game: GameState, playerId: number, horizon: number) {
  const map = mapLibrary[game.mapId], threat = new Map<string, number>();
  for (const carrier of game.carriers.filter((candidate) => candidate.owner !== playerId && candidate.cu > 0)) {
    let frontier = new Set([carrier.hex]);
    const visited = new Set([carrier.hex]);
    for (let depth = 0; depth <= horizon; depth++) {
      for (const hexId of frontier) threat.set(hexId, (threat.get(hexId) || 0) + carrier.cu);
      const next = new Set<string>();
      for (const hexId of frontier)
        for (const neighbor of getNeighbors(hexId, map)) {
          const hex = game.hexes.find((candidate) => candidate.id === neighbor);
          if (!visited.has(neighbor) && hex?.revealed && hex.kind !== "rift") {
            visited.add(neighbor);
            next.add(neighbor);
          }
        }
      frontier = next;
    }
  }
  return threat;
}

function defenseAt(game: GameState, playerId: number, hex: HexState) {
  const carriers = game.carriers.filter((carrier) => carrier.owner === playerId && carrier.hex === hex.id).reduce((sum, carrier) => sum + carrier.cu, 0);
  const guard = hex.owner === playerId && hex.tier ? (hex.centers.includes("defense") ? 3 : 1) : 0;
  return carriers + (hex.owner === playerId ? hex.combat : 0) + guard;
}

function threatSummary(game: GameState, playerId: number, threat: Map<string, number>) {
  return game.hexes
    .filter((hex) => hex.owner === playerId && hex.tier)
    .map((hex) => ({ hex, threat: threat.get(hex.id) || 0, defense: defenseAt(game, playerId, hex) }))
    .filter((entry) => entry.threat > 0)
    .sort((a, b) => b.threat - b.defense - (a.threat - a.defense));
}

function hiddenCondition(game: GameState, playerId: number) {
  const id = game.players[playerId].hiddenLegacy[game.era]?.selected;
  return hiddenLegacyDeck.find((card) => card.id === id)?.condition.toLowerCase() || "";
}

function objectiveBonus(condition: string, tags: string[]) {
  return tags.reduce((sum, tag) => sum + (condition.includes(tag) ? 9 : 0), 0);
}

function productionValue(game: GameState, playerId: number, kind: string) {
  const player = game.players[playerId];
  if (!["material", "currency", "research"].includes(kind))
    return kind === "labor" ? 10 : kind === "influence" ? 6 : 0;
  const resource = kind as Resource;
  let futureDemand = 0;
  for (let era = game.era; era <= 4; era++) {
    if (era === game.era && player.eraTributes[era - 1]) continue;
    futureDemand += tributeCosts[era][resource] || 0;
  }
  const immediateDeficit = Math.max(0, (tributeCosts[game.era][resource] || 0) - player.resources[resource]);
  const longDeficit = Math.max(0, futureDemand - player.resources[resource]);
  return immediateDeficit * 48 + longDeficit * 10 + Math.max(0, 3 - player.resources[resource]) * 3;
}

function strategicColonyStep(game: GameState, playerId: number) {
  const player = game.players[playerId], map = mapLibrary[game.mapId];
  const queue: Array<{ id: string; distance: number; first?: string }> = [{ id: player.colonyShip, distance: 0 }];
  const visited = new Set([player.colonyShip]);
  let best: { first: string; utility: number } | undefined;
  while (queue.length) {
    const current = queue.shift()!;
    const hex = game.hexes.find((candidate) => candidate.id === current.id);
    if (current.first && hex && hex.owner === undefined && economicKinds.includes(hex.kind)) {
      const utility = productionValue(game, playerId, hex.kind) - current.distance * 7;
      if (!best || utility > best.utility) best = { first: current.first, utility };
    }
    for (const neighbor of getNeighbors(current.id, map)) {
      const target = game.hexes.find((candidate) => candidate.id === neighbor);
      if (!visited.has(neighbor) && target?.revealed && target.kind !== "rift") {
        visited.add(neighbor);
        queue.push({ id: neighbor, distance: current.distance + 1, first: current.first || neighbor });
      }
    }
  }
  return best && best.utility > 18 ? best : undefined;
}

function candidate(
  order: SecretOrder,
  score: number,
  reasons: string[],
  conflicts: string[],
  counterfactual?: string,
): BotCandidate {
  return { id: order.id, order, score, reasons, conflicts, counterfactual };
}

function movementCandidates(game: GameState, playerId: number, profile: BotProfile, threat: Map<string, number>) {
  const player = game.players[playerId], map = mapLibrary[game.mapId], result: BotCandidate[] = [], condition = hiddenCondition(game, playerId);
  const colonyRoute = profile.behaviors.routeColonies ? strategicColonyStep(game, playerId) : undefined;
  const explorerHex = game.hexes.find((hex) => hex.id === player.explorer)!;
  for (const targetId of getNeighbors(player.explorer, map)) {
    const target = game.hexes.find((hex) => hex.id === targetId);
    if (!target || target.kind === "rift") continue;
    let score = target.revealed ? 9 : 33 * profile.priorities.expansion;
    if (target.revealed && target.owner === undefined && economicKinds.includes(target.kind)) score += 14;
    if (!target.revealed) score += objectiveBonus(condition, ["reveal", "unexplored", "survey"]);
    if (!target.revealed && getNeighbors(targetId, map).includes(player.colonyShip)) score += 24;
    score -= (threat.get(targetId) || 0) * profile.planning.uncertaintyPenalty;
    result.push(candidate(
      { id: `bot-explorer-${targetId}`, kind: "explorerMove", destination: targetId },
      score,
      [target.revealed ? "Improves exploration position" : "Reveals new strategic information", `Moves from ${explorerHex.id} to ${targetId}`],
      ["unit:explorer"],
    ));
  }
  if (player.faction === "farbound" && player.forwardScanUsedTurn !== game.turn)
    for (const targetId of getNeighbors(player.explorer, map)) {
      const target = game.hexes.find((hex) => hex.id === targetId);
      if (target && !target.revealed && target.kind !== "rift") result.push(candidate(
        { id: `bot-scan-${targetId}`, kind: "forwardScan", hexId: targetId },
        36 + objectiveBonus(condition, ["survey", "reveal"]),
        ["Converts uncertainty into private Farbound information", "Preserves future settlement discount options"],
        ["unit:explorer"],
      ));
    }

  const colonyHex = game.hexes.find((hex) => hex.id === player.colonyShip)!;
  if (player.modules > 0 && colonyHex.revealed && colonyHex.owner === undefined && economicKinds.includes(colonyHex.kind)) {
    const value = productionValue(game, playerId, colonyHex.kind);
    result.push(candidate(
      { id: `bot-establish-${colonyHex.id}`, kind: "establish", hexId: colonyHex.id },
      18 * profile.priorities.expansion + Math.max(18, value) + objectiveBonus(condition, ["habitat", "colon", "expansion"]),
      ["Converts the Colony Ship position into permanent production", `${colonyHex.kind} production supports direct needs, trade leverage, or future Gate costs`],
      ["unit:colony"],
    ));
  }
  for (const targetId of getNeighbors(player.colonyShip, map)) {
    const target = game.hexes.find((hex) => hex.id === targetId);
    if (!target?.revealed || target.kind === "rift") continue;
    let score = 8;
    if (target.owner === undefined && economicKinds.includes(target.kind))
      score += 18 * profile.priorities.expansion + productionValue(game, playerId, target.kind);
    if (target.owner === playerId) score += 5;
    if (colonyRoute?.first === targetId) score += 36 + colonyRoute.utility;
    score -= (threat.get(targetId) || 0) * 1.2;
    result.push(candidate(
      { id: `bot-colony-${targetId}`, kind: "colonyMove", destination: targetId },
      score,
        [target.owner === undefined && economicKinds.includes(target.kind) ? `Moves toward ${target.kind} production needed by the long-horizon Gate ledger` : "Repositions toward expansion", ...(colonyRoute?.first === targetId ? ["Follows the shortest revealed route to the highest-value production world"] : [])],
      ["unit:colony"],
    ));
  }

  const readyByHex = new Map<string, typeof game.carriers>();
  for (const carrier of game.carriers.filter((item) => item.owner === playerId && item.readyTurn <= game.turn && item.movesRemaining > 0 && item.cu > 0)) {
    const group = readyByHex.get(carrier.hex) || [];
    group.push(carrier);
    readyByHex.set(carrier.hex, group);
  }
  for (const [origin, fleet] of readyByHex) {
    const strength = fleet.reduce((sum, carrier) => sum + carrier.cu, 0), ids = fleet.map((carrier) => carrier.id);
    for (const targetId of getNeighbors(origin, map)) {
      const target = game.hexes.find((hex) => hex.id === targetId);
      if (!target?.revealed || target.kind === "rift") continue;
      const enemyCarriers = game.carriers.filter((carrier) => carrier.owner !== playerId && carrier.hex === targetId && !hasBenefit(game, playerId, carrier.owner, "defensive"));
      const hostileHabitat = target.owner !== undefined && target.owner !== playerId && !hasBenefit(game, playerId, target.owner, "openBorders");
      const owners = new Set(enemyCarriers.map((carrier) => carrier.owner));
      if (hostileHabitat && target.owner !== undefined) owners.add(target.owner);
      if ([...owners].some((owner) => hasBenefit(game, playerId, owner, "nonAggression"))) continue;
      const enemyCU = enemyCarriers.reduce((sum, carrier) => sum + carrier.cu, 0) + (hostileHabitat ? target.combat : 0);
      const assault = hostileHabitat && fleet.some((carrier) => carrier.type === "assault") ? 1 : 0;
      const guard = hostileHabitat ? Math.max(0, (target.centers.includes("defense") ? 3 : 1) - assault) : 0;
      const defense = enemyCU + guard, hostile = defense > 0;
      const responseThreat = threat.get(targetId) || 0;
      let score = 7 + (target.owner === playerId ? 5 : 0);
      const reasons: string[] = [];
      let counterfactual: string | undefined;
      if (hostile) {
        if (strength > defense) {
          const margin = strength - defense;
          score += 46 * profile.priorities.military + margin * 5 + (target.tier ? 22 * profile.priorities.denial : 0);
          reasons.push(`Exact combat forecast: ${strength} CS defeats ${defense} CS with ${margin} projected survivors`);
          if (target.tier) reasons.push(`Capturing a ${target.tier} denies production and advances territorial Legacy lines`);
        } else {
          score -= profile.behaviors.avoidMutualDestruction ? 80 : 36;
          reasons.push(`Exact combat forecast rejects ${strength} CS into ${defense} CS`);
        }
      } else {
        if (target.owner === undefined && economicKinds.includes(target.kind)) score += 13;
        reasons.push(target.owner === playerId ? "Reinforces a controlled system" : "Improves fleet projection without initiating combat");
      }
      if (responseThreat > strength) {
        const penalty = (responseThreat - strength) * (1.45 - profile.planning.riskTolerance) * profile.priorities.survival;
        score -= penalty;
        counterfactual = `If every publicly reachable rival force countered, up to ${responseThreat} CS could contest ${targetId}.`;
      } else counterfactual = `Public counter-response ceiling at ${targetId} is ${responseThreat} CS against ${strength} CS.`;
      result.push(candidate(
        { id: `bot-fleet-${origin}-${targetId}`, kind: "carrierMove", carrierIds: ids, destination: targetId },
        score,
        reasons,
        ids.map((id) => `unit:carrier:${id}`),
        counterfactual,
      ));
    }
  }

  for (const unit of game.civilianUnits.filter((item) => item.owner === playerId && item.readyTurn <= game.turn)) {
    const current = game.hexes.find((hex) => hex.id === unit.hex)!;
    if (unit.type === "prospector" && unit.movesRemaining > 0 && current.owner === undefined && !current.prospected && economicKinds.concat("barren").includes(current.kind))
      result.push(candidate(
        { id: `bot-prospect-${unit.id}`, kind: "prospect", unitId: unit.id },
        44 + objectiveBonus(condition, ["prospect", "material"]),
        ["Gains immediate Material", "Advances Foundry prospecting Legacy"],
        [`unit:civilian:${unit.id}`],
      ));
    if (unit.type === "surveyor" && player.surveyUsedTurn !== game.turn) {
      const target = game.hexes.find((hex) => !hex.revealed && hex.kind !== "rift" && !player.privateSurveys.some((survey) => survey.hexId === hex.id));
      if (target) result.push(candidate(
        { id: `bot-survey-${unit.id}-${target.id}`, kind: "longRangeSurvey", unitId: unit.id, hexId: target.id },
        42 + objectiveBonus(condition, ["survey"]),
        ["Uses global private survey reach", "Creates information and settlement value"],
        [`unit:civilian:${unit.id}`],
      ));
    }
    for (const targetId of getNeighbors(unit.hex, map)) {
      const target = game.hexes.find((hex) => hex.id === targetId);
      if (!target?.revealed || target.kind === "rift" || unit.movesRemaining < 1) continue;
      let score = target.owner === playerId ? 7 : 10;
      if (unit.type === "envoy" && target.owner !== undefined && target.owner !== playerId) score += 31;
      if (unit.type === "prospector" && target.owner === undefined && !target.prospected && economicKinds.concat("barren").includes(target.kind)) score += 29;
      result.push(candidate(
        { id: `bot-civilian-${unit.id}-${targetId}`, kind: "civilianMove", unitId: unit.id, destination: targetId },
        score,
        [unit.type === "envoy" ? "Moves toward a foreign host for diplomatic value" : "Moves toward the vessel's next faction action"],
        [`unit:civilian:${unit.id}`],
      ));
    }
  }
  return result;
}

type Construction = Extract<SecretOrder, { kind: "construct" }>["construction"];

function constructionScore(game: GameState, playerId: number, habitat: HexState, construction: Construction, profile: BotProfile, danger: number) {
  const player = game.players[playerId], condition = hiddenCondition(game, playerId), reasons: string[] = [];
  let score = 0;
  if (construction.type === "module") {
    score = player.modules === 0 ? 48 : 12;
    reasons.push(player.modules === 0 ? "Restores the ability to establish another Habitat" : "Banks future expansion capacity");
  } else if (construction.type === "upgrade") {
    score = 36 * profile.priorities.expansion + (habitat.tier === "Colony" ? 12 : 0) + objectiveBonus(condition, ["upgrade", "metropolis", "colon"]);
    reasons.push("Raises production resilience and Center capacity");
  } else if (construction.type === "center") {
    score = 20 * profile.priorities.economy;
    const center = construction.center;
    if (center === "defense") {
      score += danger * 7 * profile.priorities.survival;
      reasons.push(danger > 0 ? "Threat map identifies this Habitat as exposed" : "Adds permanent defensive strength");
    } else {
      const scarcity = center === "labor" ? Math.max(0, 5 - player.laborCap) : Math.max(0, 4 - player.resources[center]);
      score += scarcity * 4;
      if (player.faction === "helix" && center === "research") score += 20;
      if (player.faction === "foundry" && center === "material") score += 16;
      if (player.faction === "aurelians" && center === "influence") score += 16;
      if (player.faction === "meridian" && center === "currency") score += 16;
      if (["material", "currency", "research"].includes(center))
        score += productionValue(game, playerId, center) * 0.7;
      if (center === "influence" && player.resources.influence < 2 &&
          game.players.some((candidate) => candidate.id !== playerId && isContacted(game, playerId, candidate.id) &&
            !tradeEligibility(game, playerId, candidate.id).ok)) score += 34 * profile.priorities.diplomacy;
      reasons.push(`Improves recurring ${center} production and relieves a projected constraint`);
    }
    score += objectiveBonus(condition, ["center", "produce", String(construction.center)]);
  } else if (construction.type === "recruit") {
    score = 16 + construction.pairs * 8 * profile.priorities.military + danger * 8;
    reasons.push(danger > 0 ? "Adds next-Turn defense where the threat map is strongest" : "Expands deterministic combat capacity");
    score += objectiveBonus(condition, ["recruit", "combat", "cu"]);
  } else if (construction.type === "carrier") {
    const definition = carrierLibrary[construction.carrier];
    score = 13 + definition.capacity * 1.8 + definition.move * 4;
    if (player.faction === "varkesh") score += 14;
    reasons.push(`Adds ${definition.capacity} Capacity and ${definition.move} movement potential`);
    score += objectiveBonus(condition, ["vessel", "combat", "arsenal"]);
  } else {
    score = 48;
    reasons.push("Unlocks the faction's specialized exploration economy");
    score += objectiveBonus(condition, ["survey", "trade", "prospect"]);
  }
  return { score, reasons };
}

function purchaseCandidates(game: GameState, playerId: number, profile: BotProfile, threats: ReturnType<typeof threatSummary>) {
  const player = game.players[playerId], result: BotCandidate[] = [];
  for (const habitat of game.hexes.filter((hex) => hex.owner === playerId && hex.tier && hex.constructionUsedTurn !== game.turn)) {
    const danger = Math.max(0, (threats.find((entry) => entry.hex.id === habitat.id)?.threat || 0) - defenseAt(game, playerId, habitat));
    const options: Construction[] = [
      { type: "module" }, { type: "upgrade" },
      ...centers.map((center) => ({ type: "center" as const, center })),
      ...[1, 2, 3].map((pairs) => ({ type: "recruit" as const, pairs })),
      ...availableCarrierTypes(player).map((carrier) => ({ type: "carrier" as const, carrier })),
    ];
    const civilian = availableCivilianType(game, playerId);
    if (civilian) options.push({ type: "civilian", civilian });
    for (const construction of options) {
      const quote = constructionQuote(game, playerId, habitat.id, construction);
      if (!quote.available) continue;
      const order: SecretOrder = { id: `bot-build-${habitat.id}-${result.length}`, kind: "construct", habitatId: habitat.id, construction };
      if (projectedOrderBudget(game, playerId, [order]).error) continue;
      const assessment = constructionScore(game, playerId, habitat, construction, profile, danger);
      result.push(candidate(order, assessment.score, assessment.reasons, [`build:${habitat.id}`]));
    }
  }
  for (const branch of branches) {
    const quote = technologyQuote(game, playerId, branch);
    if (!quote.available) continue;
    const order: SecretOrder = { id: `bot-tech-${branch.toLowerCase()}`, kind: "technology", branch };
    if (projectedOrderBudget(game, playerId, [order]).error) continue;
    let score = 24 * profile.priorities.technology * profile.technology[branch] + (4 - player.tech[branch]) * 3;
    const reasons = [`Advances ${branch} from ${player.tech[branch]} to ${player.tech[branch] + 1}`];
    if (player.faction === "varkesh" && branch === "Military") score += 20;
    if (player.faction === "helix") score += branch === "Resource" || branch === "Military" ? 9 : 13;
    if (player.faction === "foundry" && ["Resource", "Exploration"].includes(branch)) score += 18;
    if (player.faction === "aurelians" && branch === "Policy") score += 18;
    if (player.faction === "meridian" && branch === "Economy") score += 18;
    if (player.faction === "farbound" && ["Exploration", "Policy"].includes(branch)) score += 18;
    score += objectiveBonus(hiddenCondition(game, playerId), ["technology", branch.toLowerCase()]);
    reasons.push("Faction capability ledger and objective forecast favor this branch");
    result.push(candidate(order, score, reasons, ["technology"]));
  }
  return result;
}

function gateCandidates(game: GameState, playerId: number, profile: BotProfile, plan: BotStrategicPlan) {
  const player = game.players[playerId], result: BotCandidate[] = [], target = game.players.length * 3, remaining = Math.max(0, target - game.gate);
  if (!remaining) return result;
  const turnsRemaining = 17 - game.turn, expectedShare = Math.max(0, 3 - player.tributes), behindPace = remaining / Math.max(1, turnsRemaining);
  const eraLastTurn = game.turn % 4 === 0, finalPressure = game.era === 4 ? (game.turn - 12) / 4 : 0;
  const selected = hiddenCondition(game, playerId), objectiveNeed = selected.includes("tribute");
  const scheduledGate = target * game.turn / 16;
  const gateShortfall = Math.max(0, scheduledGate - game.gate);
  const count = game.era === 4 ? Math.min(remaining, Math.max(1, plan.personalContributionTarget)) : player.eraTributes[game.era - 1] ? 0 : 1;
  for (let index = 0; index < count; index++) {
    const order: SecretOrder = { id: `bot-tribute-${index}`, kind: "tribute" };
    const existing = result.map((entry) => entry.order);
    if (projectedOrderBudget(game, playerId, [...existing, order]).error) break;
    let score = 42 + behindPace * 24 * profile.priorities.gate + finalPressure * 90;
    if (objectiveNeed) score += 28 * profile.priorities.legacy;
    if (eraLastTurn) score += 120 * profile.priorities.survival;
    if (game.turn === 16) score += 250;
    if (profile.behaviors.punishFreeRiders && !eraLastTurn && game.era < 4 && gateShortfall === 0) score -= 12;
    result.push(candidate(
      order,
      score,
      [game.turn === 16 ? "Collective survival overrides all optional spending" : "Gate pace model identifies a contribution obligation", `Personal remaining fair-share estimate is ${expectedShare}`],
      game.era < 4 ? ["tribute"] : [],
    ));
  }
  return result;
}

type BeamState = { candidates: BotCandidate[]; orders: SecretOrder[]; conflicts: Set<string>; score: number };

function reservePenalty(game: GameState, playerId: number, profile: BotProfile, orders: SecretOrder[], plan: BotStrategicPlan) {
  const budget = projectedOrderBudget(game, playerId, orders);
  if (budget.error) return { valid: false, penalty: 1000 };
  const player = game.players[playerId];
  const includesTribute = orders.some((order) => order.kind === "tribute");
  if (profile.behaviors.protectGateCompletion && !includesTribute &&
      !player.eraTributes[game.era - 1] && game.gate < game.players.length * 3) {
    const gateCost = tributeCosts[game.era];
    for (const [key, required] of Object.entries(gateCost)) {
      const before = key === "labor" ? player.labor : player.resources[key as Resource];
      const after = key === "labor" ? budget.remaining.labor : budget.remaining.resources[key as Resource];
      if (after < Math.min(before, required)) return { valid: false, penalty: 1000 };
    }
  }
  const reserve = Math.max(0, profile.planning.reserveByEra[game.era - 1]);
  let addedShortage = Math.max(0, reserve - budget.remaining.labor) - Math.max(0, reserve - player.labor);
  for (const resource of ["material", "currency", "research"] as Resource[])
    addedShortage += Math.max(0, reserve - budget.remaining.resources[resource]) -
      Math.max(0, reserve - player.resources[resource]);
  const strategicReserve = includesTribute ? plan.followupReserve : plan.reserve;
  let strategicShortage = 0;
  for (const resource of ["material", "currency", "research", "influence"] as Resource[]) {
    const beforeShortage = Math.max(0, strategicReserve[resource] - player.resources[resource]);
    const afterShortage = Math.max(0, strategicReserve[resource] - budget.remaining.resources[resource]);
    strategicShortage += Math.max(0, afterShortage - beforeShortage);
  }
  const deadlinePressure = Math.max(1, 5 - Math.max(0, plan.contributionDueTurn - game.turn));
  return { valid: true, penalty: Math.max(0, addedShortage) * 12 * profile.priorities.survival + strategicShortage * 18 * deadlinePressure };
}

function selectBundle(game: GameState, playerId: number, profile: BotProfile, candidates: BotCandidate[], plan: BotStrategicPlan) {
  const ranked = candidates
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || stableNoise(game.seed + game.turn + playerId, a.id) - stableNoise(game.seed + game.turn + playerId, b.id))
    .slice(0, profile.planning.candidateLimit);
  let beam: BeamState[] = [{ candidates: [], orders: [], conflicts: new Set(), score: 0 }], nodes = 1;
  for (const option of ranked) {
    const expanded = [...beam];
    for (const state of beam) {
      if (state.orders.length >= profile.planning.maxOrders || option.conflicts.some((token) => state.conflicts.has(token))) continue;
      const orders = [...state.orders, option.order], budget = reservePenalty(game, playerId, profile, orders, plan);
      if (!budget.valid) continue;
      nodes++;
      expanded.push({
        candidates: [...state.candidates, option],
        orders,
        conflicts: new Set([...state.conflicts, ...option.conflicts]),
        score: state.score + option.score - budget.penalty,
      });
    }
    beam = expanded.sort((a, b) => b.score - a.score || a.orders.length - b.orders.length).slice(0, profile.planning.beamWidth);
  }
  return { best: beam[0], ranked, nodes };
}

function assessment(entry: BotCandidate): BotOrderAssessment {
  return { label: orderLabel(entry.order), score: Math.round(entry.score * 10) / 10, reasons: [...entry.reasons, ...(entry.counterfactual ? [entry.counterfactual] : [])] };
}

function posture(game: GameState, playerId: number, threats: ReturnType<typeof threatSummary>) {
  const player = game.players[playerId], leader = Math.max(...game.players.map((candidate) => candidate.lp));
  if (game.turn >= 14 && game.gate < game.players.length * 3) return "Gate stabilization with selective scoring";
  if (threats.some((entry) => entry.threat > entry.defense)) return "Defensive consolidation and counter-positioning";
  if (player.lp < leader) return "Efficient Legacy acceleration and leader denial";
  if (player.faction === "varkesh") return "Controlled force projection";
  return "Flexible expansion with resource optionality";
}

export function planBotTurn(game: GameState, playerId: number, profile: BotProfile, objective?: { id?: string; reason?: string }, memory?: BotMemoryState): BotTurnPlan {
  const privateGame = projectPrivateGame(game, playerId);
  const strategicPlan = memory?.strategy || createStrategicPlan(privateGame, playerId, profile);
  const threat = reachableThreats(privateGame, playerId, profile.planning.threatHorizon), threats = threatSummary(privateGame, playerId, threat);
  const all = [
    ...movementCandidates(privateGame, playerId, profile, threat),
    ...purchaseCandidates(privateGame, playerId, profile, threats),
    ...gateCandidates(privateGame, playerId, profile, strategicPlan),
  ];
  if (profile.behaviors.multiTurnPlanning) for (const option of all) {
    const modifier = strategicOrderModifier(privateGame, playerId, option.order, strategicPlan);
    option.score += modifier.score;
    option.reasons.push(...modifier.reasons);
  }
  const selected = selectBundle(privateGame, playerId, profile, all, strategicPlan), chosen = selected.best.candidates;
  const chosenIds = new Set(chosen.map((entry) => entry.id));
  const rejected = selected.ranked.filter((entry) => !chosenIds.has(entry.id)).slice(0, 4);
  const target = game.players.length * 3, remaining = Math.max(0, target - game.gate), turnsRemaining = 17 - game.turn;
  const confidence = Math.max(0.35, Math.min(0.96, 0.88 - threats.length * 0.035 - profile.planning.uncertaintyPenalty * 0.08));
  const report: BotDecisionReport = {
    id: `bot-report-${game.turn}-${playerId}-${game.botReports.length}`,
    turn: game.turn,
    era: game.era,
    playerId,
    profileId: profile.id,
    profileName: profile.name,
    posture: posture(privateGame, playerId, threats),
    confidence,
    candidateCount: all.length,
    planningNodes: selected.nodes,
    hiddenObjectiveId: objective?.id,
    hiddenObjectiveReason: objective?.reason,
    selectedOrders: chosen.map(assessment),
    rejectedAlternatives: rejected.map(assessment),
    threats: threats.slice(0, 4).map((entry) => `${entry.hex.id}: ${entry.threat} reachable rival CS against ${entry.defense} current defense`),
    gateAnalysis: `${remaining} of ${target} shared Tributes remain with ${turnsRemaining} Turns left. Personal total: ${privateGame.players[playerId].tributes}.`,
    diplomacy: [],
    opponentModels: (memory?.opponents || []).sort((a, b) => b.lp + b.lpTrend * 2 + b.military * 0.2 - (a.lp + a.lpTrend * 2 + a.military * 0.2)).slice(0, 3)
      .map((model) => `${privateGame.players[model.playerId].name}: ${model.archetypes.join(" / ")}; ${model.lp} LP (${model.lpTrend >= 0 ? "+" : ""}${model.lpTrend}), ${model.military} CS, Gate reliability ${Math.round(model.gateReliability * 100)}%, trade reliability ${Math.round(model.tradeReliability * 100)}%`),
    commitments: (memory?.commitments || []).filter((commitment) => commitment.status !== "expired").slice(-4)
      .map((commitment) => `${commitment.status}: ${commitment.detail}`),
    metaFlags: memory?.metaFlags || [],
    strategicForecast: [
      strategicPlan.doctrine,
      `Projected Gate capacity: ${strategicPlan.collectiveProjectedTributes}/${target} (${Math.round(strategicPlan.gateConfidence * 100)}% confidence).`,
      `Personal target: ${strategicPlan.personalContributionTarget} more Tributes; next deadline Turn ${strategicPlan.contributionDueTurn}.`,
      `Priority resources: ${strategicPlan.priorityResources.join(", ")}.`,
    ],
    knowledgeBoundary: "Used public board state, this civilization's resources, surveys, objective, agreements, and submitted Orders only. Rival Hidden objectives, unrevealed worlds, and sealed rival Orders were excluded.",
    submissionOk: false,
    submissionMessage: "Plan not submitted.",
  };
  return { orders: selected.best.orders, report };
}

export function takeBotTurn(game: GameState, playerId: number, profile: BotProfile) {
  const player = game.players[playerId];
  if (player.controller.kind !== "bot" || player.controller.profileId !== profile.id)
    return { ok: false, message: "That seat is not controlled by this bot profile." };
  if (game.orderProtocol.phase !== "orders" || game.orderProtocol.currentPlayer !== playerId)
    return { ok: false, message: "The bot cannot act outside its private Orders handoff." };
  const memory = updateBotMemory(game, playerId, profile);
  const diplomacy = reviewDiplomacy(game, playerId, profile, memory);
  if (memory.strategy) diplomacy.push(...executeFactionEconomy(game, playerId, profile, memory.strategy));
  diplomacy.push(...balanceGateViaMarket(game, playerId, profile));
  diplomacy.push(...initiateDiplomacy(game, playerId, profile, memory));
  const objective = chooseHiddenObjective(game, playerId, profile);
  const plan = planBotTurn(game, playerId, profile, objective, memory);
  let submission = submitSecretOrders(game, playerId, plan.orders);
  if (!submission.ok) submission = submitSecretOrders(game, playerId, []);
  plan.report.diplomacy = diplomacy;
  plan.report.submissionOk = submission.ok;
  plan.report.submissionMessage = submission.message;
  game.botReports.unshift(plan.report);
  game.botReports = game.botReports.slice(0, 48);
  game.log.unshift(`${player.name}'s ${profile.name} controller sealed ${plan.orders.length || 1} private Order${plan.orders.length === 1 ? "" : "s"}.`);
  return { ...submission, report: plan.report, orders: plan.orders };
}

export function resolveBotCaptureDecision(game: GameState, profile: BotProfile) {
  const pending = game.pendingCenterLoss;
  if (!pending) return false;
  const player = game.players[pending.playerId], habitat = game.hexes.find((hex) => hex.id === pending.hexId);
  if (player.controller.kind !== "bot" || player.controller.profileId !== profile.id || !habitat) return false;
  const value = (center: CenterType) => {
    let score = center === "defense" ? 18 * profile.priorities.survival : center === "labor" ? 17 : 10;
    if (player.faction === "helix" && center === "research") score += 12;
    if (player.faction === "foundry" && center === "material") score += 12;
    if (player.faction === "aurelians" && center === "influence") score += 12;
    if (player.faction === "meridian" && center === "currency") score += 12;
    return score;
  };
  while (game.pendingCenterLoss) {
    const index = habitat.centers.map((center, position) => ({ position, score: value(center) })).sort((a, b) => a.score - b.score || a.position - b.position)[0]?.position;
    if (index === undefined || !removeCapturedCenter(game, pending.playerId, index).ok) break;
  }
  game.log.unshift(`${player.name}'s ${profile.name} controller removed the least valuable excess Center after capture.`);
  return true;
}
