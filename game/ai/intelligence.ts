import { getBotProfile } from "../../bots";
import { getNeighbors, shortestPath } from "../engine/geometry";
import { factionRules } from "../factions";
import { mapLibrary } from "../maps";
import { projectPrivateGame } from "../server/private-view";
import type {
  AgreementType,
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
  activeAgreements,
  addAgreementProposal,
  addTechnologyProposal,
  addTradeProposal,
  agreementCost,
  bundleTotal,
  emptyTradeBundle,
  hasBenefit,
  hasStationingPermission,
  hexDistance,
  isContacted,
  normalizeTradeBundles,
  politicalCapital,
  resolveProposal,
  setStationingPermission,
  tradeEligibility,
  technologyCost,
} from "../rules/diplomacy";
import { availableCivilianType, brokerTrade, economicSalvage, negotiationSurvey, setHomeProductionChoice, surveyExchange } from "../rules/faction-operations";
import { blockadeCargoCapacity, blockadeConstructionCost, legalBlockadeSaleDestinations, loadedBlockades } from "../rules/blockades";
import { bombardmentTargetPlayer, legalBombardmentTargets, mobileHabitatExtractionResource, mobileHabitatLibrary } from "../rules/shattered-reach";
import {
  availableCarrierTypes,
  carrierLibrary,
  removeCapturedCenter,
  totalCombatUnits,
} from "../rules/fleet";
import { availableExplorationTypes } from "../rules/exploration";
import {
  drawHiddenChoices,
  hiddenLegacyDeck,
  selectHiddenLegacy,
} from "../rules/legacy";
import { orderLabel, submitSecretOrders } from "../rules/orders";
import {
  constructionQuote,
  projectedOrderBudget,
  technologyQuote,
} from "../rules/purchases";
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
import { classifyOpponent, createStrategicPlan, factionOutlook, needsCurrencyCenter, productionPerTurn, strategicOrderModifier } from "./strategy";
import { finalEra, gateTarget, totalTurns } from "../rules/format";
import { inferObjectiveTags, scoreHiddenChoice } from "./objectives";
import { projectOrderBonus } from "./projects";

const branches: TechnologyBranch[] = ["Military", "Economy", "Policy", "Exploration", "Resource"];
const centers: CenterType[] = ["material", "currency", "research", "influence", "labor", "defense"];
const economicKinds = ["material", "currency", "research", "influence", "labor"];
const resourcesForGate: Resource[] = ["material", "currency", "research", "influence"];

function stableNoise(seed: number, key: string) {
  let hash = seed || 1;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return (hash % 1000) / 100000;
}

function strategicBundleValue(player: PlayerState, bundle: TradeBundle, plan?: BotStrategicPlan) {
  const resourceValue = (resource: Resource) => {
    const shortage = plan ? Math.max(0, (plan.reserve[resource] || 0) - player.resources[resource]) : 0;
    const goalWeight = plan?.objectivePlan.actionWeights[resource] || 0;
    const projectShortage = plan?.projectPlan.projects.slice(0, 2).reduce((maximum, project) =>
      Math.max(maximum, project.missing[resource] || 0), 0) || 0;
    return 1 + Math.max(0, 4 - player.resources[resource]) * .24 + shortage * .55 +
      Math.min(1.8, goalWeight / 90) + Math.min(1.25, projectShortage * .42);
  };
  return bundle.material * resourceValue("material") +
    bundle.currency * resourceValue("currency") +
    bundle.research * resourceValue("research") * 1.12 +
    (bundle.influence || 0) * resourceValue("influence") * 1.2 +
    bundle.labor * (2.4 + Math.max(0, 4 - player.laborCap) * .25);
}

function assessTrade(
  game: GameState,
  playerId: number,
  proposal: Extract<GameState["proposals"][number], { kind: "trade" }>,
  profile: BotProfile,
  memory: BotMemoryState,
) {
  const player = game.players[playerId], partner = game.players[proposal.from];
  const constructionValue = proposal.blockadeCommission ?
    blockadeConstructionCost.material * strategicBundleValue(player, { ...emptyTradeBundle(), material: 1 }, memory.strategy) +
    blockadeConstructionCost.currency * strategicBundleValue(player, { ...emptyTradeBundle(), currency: 1 }, memory.strategy) +
    blockadeConstructionCost.labor * strategicBundleValue(player, { ...emptyTradeBundle(), labor: 1 }, memory.strategy) : 0;
  const blockadeValue = proposal.blockadeCommission ? constructionValue + 3.5 : proposal.blockadeId ? 5.5 : 0;
  const received = strategicBundleValue(player, proposal.offer, memory.strategy) + blockadeValue;
  const paid = strategicBundleValue(player, proposal.request, memory.strategy) + constructionValue;
  const partnerGain = strategicBundleValue(partner, proposal.request) - strategicBundleValue(partner, proposal.offer) - blockadeValue;
  const model = memory.opponents.find((entry) => entry.playerId === partner.id);
  const gateNeed = (["material", "currency", "research"] as const).some((resource) =>
    proposal.offer[resource] > 0 && player.resources[resource] < (memory.strategy?.reserve[resource] || 0));
  const gateConcession = gateNeed && memory.strategy?.gateEmergency ? Math.min(2.25, paid * .28) : 0;
  const relationshipCredit = Math.max(-.8, Math.min(.8, model?.relationship || 0));
  const threatRatio = model ? model.victoryThreat / Math.max(1, ...memory.opponents.map((entry) => entry.victoryThreat)) : 0;
  const advanced = profile.difficulty === "hard" || profile.difficulty === "emperor";
  const lateGame = game.turn > totalTurns(game) * .55;
  const threatPenalty = Math.max(0, partnerGain) * threatRatio * profile.priorities.denial *
    (advanced && lateGame ? 1.1 : .72);
  const dependencyCost = advanced && lateGame && model?.stance === "contain" ?
    Math.min(1.2, (model.dependencyRisk || 0) * .12) : 0;
  const selfNet = received - paid + gateConcession + relationshipCredit - threatPenalty - dependencyCost;
  const floor = -(profile.planning.riskTolerance * .35);
  const accept = selfNet >= floor && !(model?.stance === "contain" && partnerGain > 1.2 && !gateNeed);
  return { accept, received, paid, partnerGain, selfNet, gateNeed, model };
}

function counterTrade(
  game: GameState,
  playerId: number,
  proposal: Extract<GameState["proposals"][number], { kind: "trade" }>,
  profile: BotProfile,
  memory: BotMemoryState,
) {
  if (proposal.blockadeId || proposal.blockadeCommission) return undefined;
  if ((proposal.counterDepth || 0) >= 3 || proposal.expiresAfterTurn !== undefined && proposal.expiresAfterTurn < game.turn)
    return undefined;
  const partner = game.players[proposal.from], player = game.players[playerId];
  const resources: Array<"material" | "currency" | "research" | "labor"> = hasBenefit(game, playerId, partner.id, "trade")
    ? ["material", "currency", "research", "labor"]
    : ["material", "currency", "research"];
  const initial = normalizeTradeBundles(proposal.request, proposal.offer);
  type Terms = { offer: TradeBundle; request: TradeBundle; distance: number };
  const available = (owner: PlayerState, resource: typeof resources[number]) => resource === "labor" ? owner.laborCap : owner.resources[resource];
  const key = (terms: Terms) => JSON.stringify([terms.offer, terms.request]);
  const mutuallyReasonable = (terms: Terms) => {
    const assessment = assessTrade(game, playerId, { ...proposal, offer: terms.request, request: terms.offer }, profile, memory);
    const partnerNet = strategicBundleValue(partner, terms.offer) - strategicBundleValue(partner, terms.request);
    return { assessment, partnerNet, acceptable: assessment.accept && bundleTotal(terms.offer) > 0 && bundleTotal(terms.request) > 0 };
  };
  const seen = new Set<string>();
  let current: Terms = { ...initial, distance: 0 };
  let choice: Terms | undefined;
  for (let depth = 0; depth <= 32 && !choice; depth++) {
    const currentResult = mutuallyReasonable(current);
    if (currentResult.acceptable) {
      choice = current;
      break;
    }
    const next: Terms[] = [];
    for (const resource of resources) {
      if (current.offer[resource] > 1) {
        const reduced = normalizeTradeBundles({ ...current.offer, [resource]: current.offer[resource] - 1 }, current.request);
        next.push({ ...reduced, distance: depth + 1 });
      }
      if (current.offer[resource] === 0 && current.request[resource] < available(partner, resource)) {
        const increased = normalizeTradeBundles(current.offer, { ...current.request, [resource]: current.request[resource] + 1 });
        next.push({ ...increased, distance: depth + 1 });
      }
    }
    const candidates = next.filter((terms) => {
      const token = key(terms);
      if (seen.has(token) || !bundleTotal(terms.offer) || !bundleTotal(terms.request)) return false;
      if (resources.some((resource) => terms.offer[resource] > available(player, resource) || terms.request[resource] > available(partner, resource))) return false;
      seen.add(token);
      return true;
    }).map((terms) => ({ terms, ...mutuallyReasonable(terms) }))
      .sort((a, b) => b.assessment.selfNet - a.assessment.selfNet || b.partnerNet - a.partnerNet);
    const best = candidates[0];
    if (!best || best.assessment.selfNet <= currentResult.assessment.selfNet) break;
    current = best.terms;
  }
  if (!choice) return undefined;
  const { offer, request } = choice;
  const id = `bot-counter-${game.turn}-${playerId}-${proposal.from}-${proposal.id}`;
  const result = addTradeProposal(game, {
    id,
    kind: "trade",
    from: playerId,
    to: proposal.from,
    offer,
    request,
    createdTurn: game.turn,
    status: "pending",
    counterOf: proposal.id,
    counterDepth: (proposal.counterDepth || 0) + 1,
    expiresAfterTurn: game.turn,
  });
  return result.ok ? game.proposals.find((candidate) => candidate.id === id) : undefined;
}

function updateBotMemory(game: GameState, playerId: number, profile: BotProfile) {
  const privateGame = projectPrivateGame(game, playerId);
  const previous = game.botMemory.find((memory) => memory.playerId === playerId);
  const strategy = createStrategicPlan(privateGame, playerId, profile, previous?.projects);
  const selfProduction = productionPerTurn(privateGame, playerId);
  const strategicThreatModel = profile.difficulty === "hard" || profile.difficulty === "emperor" || profile.difficulty === "expert";
  const maxHiddenPerEra = Math.max(0, ...hiddenLegacyDeck.map((card) => card.lp));
  const completedEras = Math.max(0, privateGame.era - 1);
  const priorHistory = [...privateGame.history].filter((point) => point.turn < privateGame.turn).at(-1);
  const rawOpponents = privateGame.players.filter((player) => player.id !== playerId).map((player) => {
    const old = previous?.opponents.find((model) => model.playerId === player.id);
    const priorLP = priorHistory?.players.find((entry) => entry.playerId === player.id)?.lp ?? old?.lp ?? player.lp;
    const proposals = privateGame.proposals.filter((proposal) => proposal.kind !== "technology" &&
      ((proposal.from === player.id && proposal.to === playerId) || (proposal.from === playerId && proposal.to === player.id)));
    const accepted = proposals.filter((proposal) => proposal.status === "accepted").length;
    const rejected = proposals.filter((proposal) => proposal.status === "rejected").length;
    const production = privateGame.hexes.filter((hex) => hex.owner === player.id && hex.tier)
      .reduce((sum, hex) => sum + 1 + hex.centers.filter((center) => center !== "defense").length, 0);
    const technology = Object.values(player.tech).reduce((sum, level) => sum + level, 0);
    const agreements = activeAgreements(privateGame).filter((agreement) => agreement.parties.includes(player.id)).length;
    const relationship = Math.max(-1, Math.min(1,
      (old?.relationship || 0) * .45 + accepted * .14 - rejected * .06 -
      Number(player.legacyMetrics.combatWinsAgainst.includes(playerId)) * .55));
    const objectivePressure = player.legacy.universal * 1.2 + player.legacy.civilization +
      Math.max(0, production - 3) + Math.max(0, technology - 6) * .5;
    // Rival Hidden Legacy is never inspected. The interval reflects only public LP,
    // elapsed Eras, and the deck's published maximum reward.
    const scoreFloor = player.lp;
    const scoreCeiling = player.lp + completedEras * maxHiddenPerEra;
    const rivalProduction = productionPerTurn(privateGame, player.id);
    const shortages = (["material", "currency", "research", "influence"] as const).map((resource) => ({
      resource,
      weight: (strategy.projectedDeficits[resource] || 0) +
        Math.max(0, (resource === "material" || resource === "currency" ? 2 : 1) - selfProduction[resource]),
    }));
    const forecast = factionOutlook(factionRules(player));
    const tradeFit = shortages.reduce((sum, { resource, weight }) => sum + weight *
      Math.min(3, rivalProduction[resource] + Math.max(0, player.resources[resource] - 2) * .35 +
        (forecast.resource === resource && privateGame.turn <= 5 ? .8 : 0)), 0);
    const dependencyRisk = shortages.reduce((sum, { resource, weight }) => sum +
      (selfProduction[resource] === 0 ? weight * rivalProduction[resource] : 0), 0);
    const victoryThreat = player.lp * 3.2 + (strategicThreatModel ? (scoreCeiling - scoreFloor) *
      (profile.difficulty === "emperor" ? 1.5 : 1.15) : 0) + (player.lp - priorLP) * 5 + totalCombatUnits(privateGame, player.id) * .7 +
      privateGame.hexes.filter((hex) => hex.owner === player.id && hex.tier).length * 2.4 + production * .8 + technology * .65 + agreements * 1.3 + objectivePressure;
    const gateReliability = Math.min(1, player.tributes / Math.max(1, Math.min(3, privateGame.era)));
    const gateRisk = (1 - gateReliability) * 45 + Math.max(0, privateGame.era - player.tributes) * 8;
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
      gateReliability,
      production,
      technology,
      agreements,
      objectivePressure,
      victoryThreat,
      scoreFloor,
      scoreCeiling,
      tradeFit,
      dependencyRisk,
      gateRisk,
      relationship,
    };
  });
  const averageMilitary = privateGame.players.reduce((sum, player) => sum + totalCombatUnits(privateGame, player.id), 0) / privateGame.players.length;
  const averageHabitats = privateGame.players.reduce((sum, player) => sum + privateGame.hexes.filter((hex) => hex.owner === player.id && hex.tier).length, 0) / privateGame.players.length;
  const leaderLP = Math.max(...privateGame.players.map((player) => player.lp));
  const peakThreat = Math.max(1, ...rawOpponents.map((model) => model.victoryThreat));
  const opponents = rawOpponents.map((model) => {
    const archetypes = classifyOpponent(model, averageMilitary, averageHabitats, privateGame.era, leaderLP);
    const stance = strategicThreatModel && (privateGame.turn > 4 || model.lp >= privateGame.players[playerId].lp + 3) &&
      model.victoryThreat >= peakThreat * .92 &&
      (model.scoreCeiling >= privateGame.players[playerId].lp || model.lp >= privateGame.players[playerId].lp) ? "contain" as const :
      model.gateRisk >= 45 && privateGame.turn % 4 >= 3 && gateTarget(privateGame) - privateGame.gate > 0 ? "gate-support" as const :
      archetypes.includes("militarist") && model.relationship < .25 ? "deter" as const :
      model.relationship >= .35 && model.tradeReliability >= .6 ? "cooperate" as const :
      model.victoryThreat < peakThreat * .55 ? "exploit" as const : "selective" as const;
    return { ...model, archetypes, stance };
  });
  const target = gateTarget(privateGame), turnsRemaining = totalTurns(privateGame) + 1 - privateGame.turn;
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
  const memory: BotMemoryState = { playerId, updatedTurn: privateGame.turn, opponents, commitments, metaFlags,
    projects: strategy.projectPlan.commitments };
  memory.strategy = strategy;
  const greatestThreat = opponents.slice().sort((a, b) => b.victoryThreat - a.victoryThreat)[0];
  if (greatestThreat) memory.strategy.leaderId = greatestThreat.playerId;
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
      const assessment = assessTrade(game, playerId, proposal, profile, memory);
      accept = assessment.accept;
      reason = accept
        ? `strategic value ${assessment.received.toFixed(1)} for ${assessment.paid.toFixed(1)} cleared the threshold after Gate, relationship, and threat effects`
        : `net strategic value ${assessment.selfNet.toFixed(1)} was insufficient${assessment.model?.stance === "contain" ? " while containing a victory threat" : ""}`;
    } else if (proposal.kind === "technology") {
      const compensation = proposal.compensation.material + proposal.compensation.currency + proposal.compensation.research * 1.15;
      const strategicValue = (5 - player.tech[proposal.branch]) * profile.technology[proposal.branch] * 2.6;
      const seller = memory.opponents.find((entry) => entry.playerId === proposal.seller);
      const threatPremium = seller?.stance === "contain" ? 1.5 : 1;
      const sealedTechnology = game.orderProtocol.submissions.find((submission) => submission.playerId === playerId)
        ?.orders.some((order) => order.kind === "technology");
      accept = strategicValue >= compensation * threatPremium && player.techAdvancedTurn !== game.turn && !sealedTechnology;
      reason = accept ? `${proposal.branch} advancement value exceeded compensation` : "Technology timing or compensation was inefficient";
    } else {
      const proposer = game.players[proposal.from], ownStrength = totalCombatUnits(game, playerId), theirStrength = totalCombatUnits(game, proposer.id);
      const model = memory.opponents.find((entry) => entry.playerId === proposer.id);
      const useful = proposal.agreementType === "trade" || proposal.agreementType === "research" ||
        proposal.agreementType === "nonAggression" || factionRules(player) === "aurelians" || factionRules(player) === "meridian";
      const defensiveNeed = theirStrength >= ownStrength || player.lp < Math.max(...game.players.map((candidate) => candidate.lp));
      const objectiveNeed = (memory.strategy?.objectivePlan.actionWeights.agreement || 0) > 25;
      const containConflict = model?.stance === "contain" && ["alliance", "defensive", "research"].includes(proposal.agreementType);
      const deterrent = model?.stance === "deter" && proposal.agreementType === "nonAggression";
      const cost = agreementCost(game, playerId, proposal.agreementType);
      const requiredGateInfluence = game.gate < gateTarget(game) && productionPerTurn(game, playerId).influence === 0
        ? Math.min(player.resources.influence, memory.strategy?.gateDemand.influence || 0) : 0;
      accept = player.resources.influence - cost >= requiredGateInfluence && !containConflict &&
        (useful || defensiveNeed || objectiveNeed || deterrent);
      reason = accept ? "agreement improved access, safety, or an active Legacy path" :
        containConflict ? "agreement would strengthen the leading victory threat" : "Influence was more valuable in reserve";
    }
    const blockadeDestination = proposal.kind === "trade" && (proposal.blockadeId || proposal.blockadeCommission)
      ? legalBlockadeSaleDestinations(game, playerId).sort((a, b) => Number(b.kind === "home") - Number(a.kind === "home") || a.id.localeCompare(b.id))[0]?.id
      : undefined;
    let result = resolveProposal(game, proposal.id, accept, blockadeDestination);
    if (accept && !result.ok) {
      reason = `terms could not be committed: ${result.message}`;
      accept = false;
      result = resolveProposal(game, proposal.id, false);
    }
    if (accept && result.ok && proposal.kind !== "technology" && factionRules(game.players[proposal.from]) === "aurelians")
      setStationingPermission(game, playerId, proposal.from, "envoy", true);
    if (accept && result.ok && proposal.kind === "agreement" && ["defensive", "alliance"].includes(proposal.agreementType))
      setStationingPermission(game, playerId, proposal.from, "defensive", true);
    decisions.push(`${accept ? "Accepted" : "Rejected"} ${proposal.kind} proposal: ${reason}${result.ok ? "" : `; resolution failed: ${result.message}`}.`);
    if (!accept && result.ok && proposal.kind === "trade") {
      const counter = counterTrade(game, playerId, proposal, profile, memory);
      if (counter) decisions.push(`Countered with revised terms that preserve the current Gate reserve and Legacy plan.`);
    }
  }
  return decisions;
}

/** Review pending proposals addressed to a bot without requiring a new Orders handoff. */
export function reviewBotDiplomacy(game: GameState, playerId: number) {
  const player = game.players[playerId];
  if (!player || player.controller.kind !== "bot")
    return { ok: false, messages: ["That civilization is not controlled by a bot."] };
  const profile = getBotProfile(player.controller.profileId);
  if (!profile)
    return { ok: false, messages: [`Bot profile '${player.controller.profileId}' is not installed.`] };
  const memory = updateBotMemory(game, playerId, profile);
  const messages = reviewDiplomacy(game, playerId, profile, memory);
  for (const message of messages) game.log.unshift(`${player.name}: ${message}`);
  return { ok: true, messages };
}

function proposeGoalAgreement(game: GameState, playerId: number, memory: BotMemoryState) {
  const player = game.players[playerId];
  const requiredPolicy = { trade: 1, nonAggression: 1, openBorders: 2, research: 2, defensive: 3, alliance: 3 } as const;
  const types: AgreementType[] = ["trade", "nonAggression", "research", "openBorders", "defensive", "alliance"];
  const options = game.players.filter((partner) => partner.id !== playerId && isContacted(game, playerId, partner.id))
    .flatMap((partner) => {
      const model = memory.opponents.find((opponent) => opponent.playerId === partner.id);
      return types.filter((type) => player.tech.Policy >= requiredPolicy[type] && partner.tech.Policy >= requiredPolicy[type] &&
        !(model?.stance === "contain" && ["research", "defensive", "alliance"].includes(type)) &&
        !activeAgreements(game, playerId, partner.id).some((agreement) => agreement.type === type) &&
        player.resources.influence >= agreementCost(game, playerId, type) &&
        partner.resources.influence >= agreementCost(game, partner.id, type))
        .map((type) => ({ partner, type, score: (model?.relationship || 0) * 10 - (model?.victoryThreat || 0) * .1 +
          (model?.tradeFit || 0) * (game.turn <= 5 ? 1.2 : .45) +
          (type === "trade" ? ["material", "currency", "research"].reduce((sum, resource) =>
            sum + (memory.strategy?.projectPlan.projects[0]?.route[resource as Resource] === "trade" &&
              (memory.strategy?.projectPlan.projects[0]?.missing[resource as Resource] || 0) > 0 ?
                productionPerTurn(game, partner.id)[resource as Resource] * 12 : 0), 0) : 0) +
          (factionRules(player) === "foundry" && productionPerTurn(game, playerId).currency === 0 && type === "trade" ?
            15 + (factionOutlook(factionRules(partner)).resource === "currency" ? 45 : 0) +
              Math.min(20, productionPerTurn(game, partner.id).currency * 8) : 0) +
          (activeAgreements(game, playerId, partner.id).length === 0 ? 25 : 0) - types.indexOf(type) }));
    }).sort((a, b) => b.score - a.score || a.partner.id - b.partner.id);
  const choice = options[0];
  if (!choice) return [];
  const result = addAgreementProposal(game, {
    id: `bot-goal-agreement-${game.turn}-${playerId}-${choice.partner.id}-${choice.type}`,
    kind: "agreement", from: playerId, to: choice.partner.id, agreementType: choice.type,
    createdTurn: game.turn, status: "pending",
  });
  return result.ok ? [`Proposed ${choice.type} cooperation to ${choice.partner.name} to advance the diplomatic Legacy plan.`] : [];
}

function initiateDiplomacy(game: GameState, playerId: number, profile: BotProfile, memory: BotMemoryState) {
  const player = game.players[playerId], decisions: string[] = [];
  const pending = game.proposals.filter((proposal) => proposal.status === "pending" &&
      (proposal.kind === "technology" ? proposal.seller === playerId : proposal.from === playerId));
  if (pending.length >= 2) return decisions;
  const tradable = ["material", "currency", "research"] as const;
  const cost = tributeCosts[game.era];
  const projectNeeds = (memory.strategy?.projectPlan.projects || []).slice(0, 2).flatMap((project) =>
    tradable.filter((resource) => (project.missing[resource] || 0) > 0 && project.route[resource] === "trade"));
  const needs = tradable.filter((resource) => player.resources[resource] < (cost[resource] || 0) ||
    (memory.strategy?.projectedDeficits[resource] || 0) > 0 || projectNeeds.includes(resource))
    .sort((a, b) => Number(projectNeeds.includes(b)) - Number(projectNeeds.includes(a)) ||
      (memory.strategy?.projectedDeficits[b] || 0) - (memory.strategy?.projectedDeficits[a] || 0));
  const foundryCurrencyShortage = factionRules(player) === "foundry" && productionPerTurn(game, playerId).currency === 0;
  if (foundryCurrencyShortage) {
    const index = needs.indexOf("currency");
    if (index >= 0) needs.splice(index, 1);
    needs.unshift("currency");
  }
  const tradeGoal = (memory.strategy?.objectivePlan.actionWeights.trade || 0) > 25 ||
    (memory.strategy?.priorities.find((priority) => priority.key === "trade")?.weight || 0) >= 25;
  const agreementGoal = projectNeeds.length > 0 || (memory.strategy?.objectivePlan.actionWeights.agreement || 0) > 25 ||
    (memory.strategy?.priorities.find((priority) => priority.key === "agreement")?.weight || 0) >= 25;
  const activeAgreementCount = activeAgreements(game, playerId).length;
  const prioritizeAgreement = agreementGoal && activeAgreementCount === 0 && !memory.strategy?.gateEmergency;
  if (tradeGoal && !needs.length) {
    const preferred = (memory.strategy?.priorityResources || []).filter((resource): resource is typeof tradable[number] => resource !== "influence");
    const objectiveNeed = preferred.find((resource) => player.resources[resource] <= Math.max(3, memory.strategy?.reserve[resource] || 0)) || preferred[0] || tradable[0];
    if (objectiveNeed) needs.push(objectiveNeed);
  }
  const offers = tradable
    .filter((resource) => player.resources[resource] > Math.max(1, cost[resource] || 0,
      memory.strategy?.projectPlan.projects[0]?.next.cost[resource] || 0))
    .sort((a, b) => player.resources[b] - player.resources[a]);
  // Influence cannot be purchased through the Market. Preserve the final Era
  // Gate input if the civilization has no recurring Influence production.
  const influenceReserve = game.gate < gateTarget(game) && productionPerTurn(game, playerId).influence === 0 &&
    player.resources.influence <= (memory.strategy?.gateDemand.influence || 0);
  if (agreementGoal && (!influenceReserve || foundryCurrencyShortage && game.turn <= 4) &&
      !pending.some((proposal) => proposal.kind === "agreement"))
    decisions.push(...proposeGoalAgreement(game, playerId, memory));
  if (pending.some((proposal) => proposal.kind !== "agreement")) return decisions;
  if (factionRules(player) === "helix") {
    const exchange = game.players.filter((candidate) => candidate.id !== playerId)
      .flatMap((buyer) => branches.filter((branch) => player.tech[branch] === buyer.tech[branch] + 1 &&
        buyer.techAdvancedTurn !== game.turn && tradeEligibility(game, playerId, buyer.id).ok)
        .map((branch) => ({ buyer, branch, cost: technologyCost(game, buyer.id, branch, buyer.tech[branch] + 1, true) })))
      .filter((entry) => canPay(entry.buyer, entry.cost))
      .sort((a, b) => (memory.strategy?.priorityResources.includes(a.branch === "Military" || a.branch === "Resource" ? "material" : "currency") ? -1 : 0) -
        (memory.strategy?.priorityResources.includes(b.branch === "Military" || b.branch === "Resource" ? "material" : "currency") ? -1 : 0) || a.buyer.id - b.buyer.id)[0];
    if (exchange) {
      const compensation = { material: 0, currency: 0, research: 0 };
      const buyerModel = memory.opponents.find((entry) => entry.playerId === exchange.buyer.id);
      const requestedResource = memory.strategy?.priorityResources
        .filter((resource): resource is "material" | "currency" | "research" => resource !== "influence")
        .find((resource) => exchange.buyer.resources[resource] >= (exchange.cost[resource] || 0) + 1);
      if (requestedResource && (buyerModel?.stance === "contain" || player.resources[requestedResource] < 2)) compensation[requestedResource] = 1;
      const result = addTechnologyProposal(game, {
        id: `bot-tech-exchange-${game.turn}-${playerId}-${exchange.buyer.id}-${exchange.branch}`,
        kind: "technology", seller: playerId, buyer: exchange.buyer.id, branch: exchange.branch,
        level: exchange.buyer.tech[exchange.branch] + 1, compensation,
        createdTurn: game.turn, status: "pending",
      });
      if (result.ok) {
        decisions.push(`Offered ${exchange.branch} Technology to ${exchange.buyer.name} to improve coalition capacity.`);
        return decisions;
      }
    }
  }
  if (factionRules(player) === "spires" && player.tech.Resource < 4 && player.resources.currency >= 4) {
    const income = productionPerTurn(game, playerId);
    const need = income.material < 2 && player.resources.material < 4 ? "material" :
      income.research < 2 && player.resources.research < 3 ? "research" : undefined;
    const partner = need && game.players.filter((candidate) => candidate.id !== playerId &&
      tradeEligibility(game, playerId, candidate.id).ok &&
      candidate.resources[need] > (tributeCosts[game.era][need] || 0) + 2 &&
      candidate.resources.currency < 4)
      .sort((a, b) => b.resources[need] - a.resources[need] || a.id - b.id)[0];
    if (partner && need) {
      const offer = emptyTradeBundle(), request = emptyTradeBundle();
      offer.currency = 2; request[need] = 1;
      const result = addTradeProposal(game, { id: `bot-spires-resource-${game.turn}-${playerId}-${partner.id}`,
        kind: "trade", from: playerId, to: partner.id, offer, request,
        createdTurn: game.turn, status: "pending" });
      if (result.ok) {
        decisions.push(`Offered Currency to ${partner.name} for ${need} toward Resource IV infrastructure.`);
        return decisions;
      }
    }
  }
  if (factionRules(player) === "aurelians" && player.tech.Policy >= 2 &&
      player.resources.influence >= Math.max(3, (memory.strategy?.reserve.influence || 0) + 2) &&
      new Set(player.legacyMetrics.aurelianInfluenceTradePartners || []).size < 3) {
    const partner = game.players.filter((candidate) => candidate.id !== playerId &&
      !(player.legacyMetrics.aurelianInfluenceTradePartners || []).includes(candidate.id) &&
      candidate.resources.influence <= 1 && tradeEligibility(game, playerId, candidate.id).ok)
      .sort((a, b) => a.resources.influence - b.resources.influence || a.id - b.id)[0];
    const resource = partner && (["material", "currency", "research"] as const)
      .filter((item) => partner.resources[item] > (tributeCosts[game.era][item] || 0) + 1)
      .sort((a, b) => player.resources[a] - player.resources[b])[0];
    if (partner && resource) {
      const offer = emptyTradeBundle(), request = emptyTradeBundle();
      offer.influence = 1;
      request[resource] = 1;
      const result = addTradeProposal(game, { id: `bot-influence-${game.turn}-${playerId}-${partner.id}`,
        kind: "trade", from: playerId, to: partner.id, offer, request,
        createdTurn: game.turn, status: "pending" });
      if (result.ok) {
        decisions.push(`Offered Influence to ${partner.name} for surplus ${resource} and an Influence Broker partnership.`);
        return decisions;
      }
    }
  }
  if (!prioritizeAgreement && profile.behaviors.coordinateGateSupport) {
    const support = game.players
      .filter((candidate) => candidate.id !== playerId && !candidate.eraTributes[game.era - 1])
      .map((partner) => {
        const missing = tradable.filter((resource) => partner.resources[resource] < (cost[resource] || 0));
        const model = memory.opponents.find((entry) => entry.playerId === partner.id);
        return { partner, missing, reliability: model?.gateReliability || 0 };
      })
      .filter((entry) => entry.missing.length > 0 && tradeEligibility(game, playerId, entry.partner.id).ok)
      .filter((entry) => {
        const model = memory.opponents.find((candidate) => candidate.playerId === entry.partner.id);
        return memory.strategy?.gateEmergency || model?.stance !== "contain";
      })
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
  if (!prioritizeAgreement) for (const need of needs) {
    for (const offer of offers.filter((resource) => resource !== need)) {
      const partners = game.players
        .filter((candidate) => candidate.id !== playerId && candidate.resources[need] > Math.max(1, cost[need] || 0))
        .filter((candidate) => tradeGoal || candidate.resources[offer] < Math.max(2, cost[offer] || 0) + 1 ||
          productionPerTurn(game, candidate.id)[offer] === 0)
        .filter((candidate) => tradeEligibility(game, playerId, candidate.id).ok)
        .sort((a, b) => {
          const aModel = memory.opponents.find((entry) => entry.playerId === a.id);
          const bModel = memory.opponents.find((entry) => entry.playerId === b.id);
          const traded = player.legacyMetrics.tradePartners[game.era - 1] || [];
          const strategicPartner = profile.difficulty === "hard" || profile.difficulty === "emperor";
          const lateGame = game.turn > totalTurns(game) * .55;
          const utility = (partner: PlayerState, model: typeof aModel) => partner.resources[need] -
            (model?.victoryThreat || 0) * (strategicPartner && lateGame ? .13 : .05) +
            (model?.relationship || 0) * 2 + (traded.includes(partner.id) ? 0 : 5) +
            (strategicPartner ? (model?.tradeFit || 0) * (lateGame ? .15 : .5) -
              (lateGame ? (model?.dependencyRisk || 0) * .5 : 0) : 0);
          const aUtility = utility(a, aModel);
          const bUtility = utility(b, bModel);
          const currencyFit = (partner: PlayerState) => foundryCurrencyShortage && need === "currency" ?
            (factionOutlook(factionRules(partner)).resource === "currency" ? 15 : 0) +
              productionPerTurn(game, partner.id).currency * 5 : 0;
          return bUtility + currencyFit(b) - aUtility - currencyFit(a) || a.id - b.id;
        });
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
        decisions.push(`Proposed 1 ${offer} for 1 ${need} to ${partner.name} for resource balance and the active Legacy plan.`);
        return decisions;
      }
    }
  }
  if (!prioritizeAgreement && needs.length && player.laborCap > 1) {
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
  if (decisions.length || pending.some((proposal) => proposal.kind === "agreement")) return decisions;
  const agreementPartner = game.players
    .filter((candidate) => candidate.id !== playerId && isContacted(game, playerId, candidate.id))
    .filter((candidate) => !hasBenefit(game, playerId, candidate.id, "trade"))
    .filter((candidate) => candidate.resources.influence > 0)
    .map((candidate) => ({
      candidate,
      complement: needs.reduce((sum, resource) => sum + Math.max(0, candidate.resources[resource] - (cost[resource] || 0)), 0) +
        offers.reduce((sum, resource) => sum + Math.max(0, (cost[resource] || 0) - candidate.resources[resource]), 0),
    }))
    .filter((entry) => entry.complement > 0 || factionRules(player) === "aurelians" || agreementGoal)
    .sort((a, b) => {
      const value = (entry: typeof a) => {
        const model = memory.opponents.find((candidate) => candidate.playerId === entry.candidate.id);
        const late = game.turn > totalTurns(game) * .55;
        return entry.complement + projectNeeds.reduce((sum, resource) =>
          sum + productionPerTurn(game, entry.candidate.id)[resource] * 7, 0) + (foundryCurrencyShortage ?
          (factionOutlook(factionRules(entry.candidate)).resource === "currency" ? 30 : 0) +
          productionPerTurn(game, entry.candidate.id).currency * 8 : 0) +
          (profile.difficulty === "hard" || profile.difficulty === "emperor" ?
          (model?.tradeFit || 0) * (late ? .15 : .6) - (late ? (model?.dependencyRisk || 0) * .5 : 0) -
          (model?.stance === "contain" ? 3 : 0) : 0);
      };
      return value(b) - value(a) || a.candidate.id - b.candidate.id;
    })[0]?.candidate;
  if (agreementPartner && player.resources.influence > 0 && profile.priorities.diplomacy > 0) {
    const model = memory.opponents.find((entry) => entry.playerId === agreementPartner.id);
    const wantsAgreement = agreementGoal;
    const agreementChoices: AgreementType[] = factionRules(player) === "aurelians" || wantsAgreement
      ? ["trade", "nonAggression", "research", "openBorders", "defensive", "alliance"]
      : ["trade", "nonAggression"];
    const agreementType = agreementChoices.find((type) =>
      !(model?.stance === "contain" && ["research", "defensive", "alliance"].includes(type)) &&
      player.tech.Policy >= ({ trade: 1, nonAggression: 1, openBorders: 2, research: 2, defensive: 3, alliance: 3 } as const)[type] &&
      agreementPartner.tech.Policy >= ({ trade: 1, nonAggression: 1, openBorders: 2, research: 2, defensive: 3, alliance: 3 } as const)[type] &&
      !activeAgreements(game, playerId, agreementPartner.id).some((agreement) => agreement.type === type));
    if (!agreementType) return decisions;
    const result = addAgreementProposal(game, {
      id: `bot-${agreementType}-agreement-${game.turn}-${playerId}-${agreementPartner.id}`,
      kind: "agreement",
      from: playerId,
      to: agreementPartner.id,
      agreementType,
      createdTurn: game.turn,
      status: "pending",
    });
    if (result.ok) decisions.push(`Proposed ${agreementType} cooperation to ${agreementPartner.name} for the active diplomatic and Legacy plan.`);
    if (result.ok) rememberCommitment(memory, { partnerId: agreementPartner.id, createdTurn: game.turn,
      expiresTurn: game.turn + profile.planning.diplomacyHorizon, purpose: "trade-network",
      detail: `Open a permanent resource route with ${agreementPartner.name}`, status: "offered" });
  }
  return decisions;
}

function executeFactionEconomy(game: GameState, playerId: number, profile: BotProfile, plan: BotStrategicPlan) {
  const player = game.players[playerId], actions: string[] = [];
  if (!profile.behaviors.factionDoctrine) return actions;
  if (["varkesh", "farbound", "helix"].includes(factionRules(player))) {
    const rules = factionRules(player);
    const allowed = rules === "varkesh" ? ["material", "currency"] as const : rules === "helix" ? ["research", "material", "currency"] as const : ["research", "currency"] as const;
    const currencyBootstrap = game.turn <= totalTurns(game) - 3 && needsCurrencyCenter(game, playerId) &&
      player.resources.currency < 2;
    const choice = currencyBootstrap && player.resources.material < 1 && rules !== "farbound" ? "material" :
      currencyBootstrap ? "currency" : rules === "helix"
      ? player.resources.currency < 1 ? "currency" : player.resources.material < 1 ? "material" : player.resources.research < 2 ? "research"
        : [...allowed].sort((a, b) => (player.resources[a] - (plan.reserve[a] || 0)) - (player.resources[b] - (plan.reserve[b] || 0)))[0]
      : [...allowed].sort((a, b) => plan.priorityResources.indexOf(a) - plan.priorityResources.indexOf(b))[0];
    const result = setHomeProductionChoice(game, playerId, choice);
    if (result.ok) actions.push(`Faction doctrine: Homeworld production set to ${choice} for the strategic reserve.`);
  }
  for (const guest of game.players.filter((candidate) => candidate.id !== playerId && factionRules(candidate) === "aurelians" &&
    isContacted(game, playerId, candidate.id) && activeAgreements(game, playerId, candidate.id).length > 0)) {
    if (hasStationingPermission(game, playerId, guest.id, "envoy")) continue;
    const result = setStationingPermission(game, playerId, guest.id, "envoy", true);
    if (result.ok) actions.push(`Diplomatic doctrine: granted ${guest.name} Envoy-hosting permission to support reciprocal relations.`);
  }
  if (factionRules(player) === "farbound" && player.negotiationSurveyUsedTurn !== game.turn) {
    const targets = game.hexes
      .filter((hex) => !hex.revealed && !player.privateSurveys.some((survey) => survey.hexId === hex.id))
      .sort((a, b) => {
        const aScore = Number(player.colonyShips.some((unit) => getNeighbors(unit.hex, mapLibrary[game.mapId]).includes(a.id))) * 2 + Number(getNeighbors(player.explorer, mapLibrary[game.mapId]).includes(a.id));
        const bScore = Number(player.colonyShips.some((unit) => getNeighbors(unit.hex, mapLibrary[game.mapId]).includes(b.id))) * 2 + Number(getNeighbors(player.explorer, mapLibrary[game.mapId]).includes(b.id));
        return bScore - aScore || a.id.localeCompare(b.id);
      });
    for (const target of targets) {
      const result = negotiationSurvey(game, playerId, target.id);
      if (!result.ok) continue;
      actions.push("Faction doctrine: gathered one private survey for settlement planning and same-Turn information trade.");
      break;
    }
  }
  if (factionRules(player) === "aurelians" && !player.eraTributes[game.era - 1]) {
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
  if (factionRules(player) === "aurelians" && game.turn <= 8 &&
      productionPerTurn(game, playerId).currency === 0 &&
      game.hexes.some((hex) => hex.owner === playerId && hex.tier && hex.centers.length < 3)) {
    while (player.resources.currency < 2 && player.resources.influence >= 3 &&
        player.resources.material >= 1) {
      const result = politicalCapital(game, playerId, "currency");
      if (!result.ok) break;
      actions.push("Faction doctrine: reserved converted Currency for the first permanent economic Center.");
    }
  }
  if (factionRules(player) === "aurelians" && player.tech.Policy >= 2 &&
      (player.legacyMetrics.aurelianMarketInfluenceSpent || 0) < 8 &&
      game.turn <= totalTurns(game) - 2) {
    const reserve = Math.max(2, plan.reserve.influence || 0);
    const need = (["research", "material", "currency"] as const).slice().sort((a, b) =>
      (productionPerTurn(game, playerId)[a] + player.resources[a]) - (productionPerTurn(game, playerId)[b] + player.resources[b]))[0];
    if (player.resources.influence >= reserve + 2 && player.resources[need] < 4) {
      const result = marketExchange(game, playerId, "influence", need);
      if (result.ok) actions.push(`Faction doctrine: exchanged Influence for ${need} and advanced Political Exchange.`);
    }
  }
  if (factionRules(player) === "spires" && player.tech.Resource < 4) {
    const income = productionPerTurn(game, playerId);
    const next = technologyCost(game, playerId, "Resource", player.tech.Resource + 1);
    const needed = income.material < 2 && player.resources.material < 2 ||
      player.tech.Resource >= 2 && player.resources.material < (next.material || 0) ? "material" :
      income.research === 0 && player.resources.research < 2 ? "research" : undefined;
    if (needed) for (let attempt = 0; attempt < 2; attempt++) {
      const rate = marketRate(player, "currency", needed);
      if (!rate || player.resources.currency < rate + Math.max(1, plan.reserve.currency || 0) ||
          player.resources[needed] >= Math.max(2, next[needed] || 0)) break;
      const result = marketExchange(game, playerId, "currency", needed);
      if (!result.ok) break;
      actions.push(`Spires Resource IV plan: converted surplus Currency into ${needed} for its next milestone.`);
    }
  }
  if (factionRules(player) === "meridian" && plan.gateEmergency && player.resources.currency < (tributeCosts[game.era].currency || 0)) {
    const stationed = game.hexes.filter((hex) => hex.owner === playerId).reduce((sum, hex) => sum + hex.combat, 0);
    if (stationed >= 8) {
      const result = economicSalvage(game, playerId);
      if (result.ok) actions.push("Faction doctrine: converted surplus stationed CU into emergency Currency.");
    }
  }
  if (factionRules(player) === "meridian") {
    // Automated brokerage may settle immediately only when both trading parties are bots.
    // Human civilizations must explicitly consent through the room offer workflow.
    const others = game.players.filter((candidate) => candidate.id !== playerId && candidate.controller.kind === "bot");
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
  if (factionRules(player) === "farbound" && player.tech.Policy >= 2) {
    const survey = player.privateSurveys.find((entry) => !game.hexes.find((hex) => hex.id === entry.hexId)?.revealed && entry.soldTo.length < game.players.length - 1);
    const buyer = game.players.filter((candidate) => candidate.id !== playerId && !survey?.soldTo.includes(candidate.id) && candidate.resources.currency > (tributeCosts[game.era].currency || 0))
      .filter((candidate) => candidate.id !== plan.leaderId || plan.victoryPressure < 3)
      .sort((a, b) => b.resources.currency - a.resources.currency || a.id - b.id)[0];
    if (survey && buyer) {
      const result = surveyExchange(game, playerId, buyer.id, survey.hexId, 1);
      if (result.ok) actions.push(`Faction doctrine: sold one private survey to ${buyer.name}, creating flexible Currency without aiding a runaway leader.`);
    }
  }
  if (factionRules(player) === "aegis" && player.tech.Economy >= 2 &&
      !game.proposals.some((proposal) => proposal.kind === "trade" && proposal.from === playerId &&
        (proposal.blockadeId || proposal.blockadeCommission) && proposal.status === "pending")) {
    const buyers = game.players.filter((candidate) => candidate.id !== playerId &&
      candidate.resources.material >= blockadeConstructionCost.material &&
      candidate.resources.currency >= blockadeConstructionCost.currency + 1 &&
      candidate.labor >= blockadeConstructionCost.labor &&
      tradeEligibility(game, playerId, candidate.id).ok && legalBlockadeSaleDestinations(game, candidate.id).length > 0)
      .sort((a, b) => b.resources.currency - a.resources.currency || a.id - b.id);
    const buyer = buyers.find((candidate) => !game.proposals.some((proposal) => proposal.kind === "trade" &&
      proposal.from === playerId && proposal.to === candidate.id && proposal.blockadeCommission &&
      proposal.createdTurn === game.turn && proposal.status !== "rejected" && proposal.status !== "cancelled"));
    if (buyer) {
      const request = emptyTradeBundle();
      request.currency = 1;
      const result = addTradeProposal(game, {
        id: `bot-blockade-commission-${game.turn}-${playerId}-${buyer.id}`,
        kind: "trade", from: playerId, to: buyer.id,
        offer: emptyTradeBundle(), request, blockadeCommission: true,
        createdTurn: game.turn, status: "pending", expiresAfterTurn: game.turn,
      });
      if (result.ok) actions.push(`Faction doctrine: offered a new Blockade to ${buyer.name} for construction cost plus one Currency.`);
    }
  }
  return actions;
}

function balanceGateViaMarket(game: GameState, playerId: number, profile: BotProfile) {
  if (!profile.behaviors.useMarketForGate) return [] as string[];
  const player = game.players[playerId], actions: string[] = [];
  if (game.gate >= gateTarget(game)) return actions;
  const plan = createStrategicPlan(game, playerId, profile);
  if (!plan.personalContributionTarget) return actions;
  const goalEra = game.era < finalEra(game) && player.eraTributes[game.era - 1] ? game.era + 1 : game.era;
  const unitCost = tributeCosts[goalEra];
  const count = goalEra === finalEra(game) && game.era === finalEra(game) ? Math.max(1, Math.min(plan.personalContributionTarget,
    Math.floor(player.labor / Math.max(1, unitCost.labor || 0)))) : 1;
  const cost = Object.fromEntries(Object.entries(unitCost).map(([resource, amount]) => [resource, amount * count])) as typeof unitCost;
  if (canPay(player, cost)) return actions;
  for (let attempt = 0; attempt < 12 && !canPay(player, cost); attempt++) {
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

function chooseHiddenObjective(game: GameState, playerId: number, profile: BotProfile) {
  drawHiddenChoices(game, playerId, game.era);
  const state = game.players[playerId].hiddenLegacy[game.era];
  if (state.selected) return { id: state.selected, reason: "Previously selected for this Era." };
  const privateGame = projectPrivateGame(game, playerId);
  const ranked = state.choices.map((id) => {
    const card = hiddenLegacyDeck.find((candidate) => candidate.id === id)!;
    const structured = scoreHiddenChoice(privateGame, playerId, profile, id);
    const manualPenalty = card.automatic ? 0 : 13;
    const tagBreadth = inferObjectiveTags(card.condition, card.id).length;
    const score = structured.score + tagBreadth * 1.5 - manualPenalty;
    return { card, score, reason: structured.reason };
  }).sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));
  const selected = ranked[0];
  selectHiddenLegacy(game, playerId, selected.card.id);
  return {
    id: selected.card.id,
    reason: `${selected.card.lp} LP objective selected at score ${selected.score.toFixed(1)}. ${selected.reason}`,
  };
}

function reachableThreats(game: GameState, playerId: number, horizon: number) {
  const map = mapLibrary[game.mapId], threat = new Map<string, number>();
  for (const carrier of game.carriers.filter((candidate) => candidate.owner !== playerId && candidate.cu > 0 &&
    !hasBenefit(game, playerId, candidate.owner, "nonAggression"))) {
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
  if (kind === "labor") return 10;
  if (!["material", "currency", "research", "influence"].includes(kind)) return 0;
  const resource = kind as Resource;
  const remaining = Math.max(0, gateTarget(game) - game.gate);
  let share = Math.min(remaining, Math.max(0, finalEra(game) - 1 - player.tributes,
    Math.ceil(remaining / game.players.length)));
  let futureDemand = 0;
  for (let era = game.era; era < finalEra(game) && share > 0; era++) {
    if (era === game.era && player.eraTributes[era - 1]) continue;
    futureDemand += tributeCosts[era][resource] || 0;
    share--;
  }
  futureDemand += share * (tributeCosts[finalEra(game)][resource] || 0);
  const currentCost = remaining === 0 || player.eraTributes[game.era - 1] && game.era < finalEra(game)
    ? 0 : tributeCosts[game.era][resource] || 0;
  const immediateDeficit = Math.max(0, currentCost - player.resources[resource]);
  const longDeficit = Math.max(0, futureDemand - player.resources[resource]);
  if (resource === "influence") {
    const firstDueEra = [game.era, ...Array.from({ length: finalEra(game) - game.era }, (_, index) => game.era + index + 1)]
      .find((era) => (tributeCosts[era].influence || 0) > 0);
    const income = productionPerTurn(game, playerId).influence;
    const turnsToDue = firstDueEra ? Math.max(0, (firstDueEra - 1) * 4 + 4 - game.turn) : 0;
    const projectedShortfall = Math.max(0, futureDemand - player.resources.influence - income * turnsToDue);
    return immediateDeficit * 48 + projectedShortfall * 22 + (projectedShortfall && !income ? 18 : 0);
  }
  return immediateDeficit * 48 + longDeficit * 10 + Math.max(0, 3 - player.resources[resource]) * 3;
}

function strategicColonyStep(game: GameState, playerId: number, origin: string) {
  const map = mapLibrary[game.mapId];
  const position = game.hexes.find((hex) => hex.id === origin);
  // Stay on a settlement site while establishing or obtaining a replacement Module.
  if (position?.revealed && position.owner === undefined && economicKinds.includes(position.kind)) return undefined;
  const queue: Array<{ id: string; distance: number; first?: string }> = [{ id: origin, distance: 0 }];
  const visited = new Set([origin]);
  let best: { first: string; utility: number } | undefined;
  while (queue.length) {
    const current = queue.shift()!;
    const hex = game.hexes.find((candidate) => candidate.id === current.id);
    if (current.first && hex && hex.owner === undefined && economicKinds.includes(hex.kind)) {
      const utility = 35 + productionValue(game, playerId, hex.kind) - current.distance * 7;
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

function mobileResourceRoute(game: GameState, origin: string, resource: "currency" | "material") {
  const queue: Array<{ id: string; first?: string }> = [{ id: origin }];
  const visited = new Set([origin]);
  while (queue.length) {
    const current = queue.shift()!;
    const hex = game.hexes.find((candidate) => candidate.id === current.id);
    if (current.first && hex?.kind === resource && hex.revealed) return current.first;
    for (const neighbor of getNeighbors(current.id, mapLibrary[game.mapId])) {
      const next = game.hexes.find((candidate) => candidate.id === neighbor);
      if (visited.has(neighbor) || !next?.revealed || next.kind === "rift") continue;
      visited.add(neighbor);
      queue.push({ id: neighbor, first: current.first || neighbor });
    }
  }
  return undefined;
}

function nextUnrevealedStep(game: GameState, origin: string) {
  const queue: Array<{ id: string; first?: string; distance: number }> = [{ id: origin, distance: 0 }];
  const visited = new Set([origin]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const neighbor of getNeighbors(current.id, mapLibrary[game.mapId])) {
      if (visited.has(neighbor)) continue;
      const hex = game.hexes.find((candidate) => candidate.id === neighbor);
      if (!hex || hex.kind === "rift") continue;
      if (!hex.revealed) return { step: current.first || neighbor, distance: current.distance + 1 };
      visited.add(neighbor);
      queue.push({ id: neighbor, first: current.first || neighbor, distance: current.distance + 1 });
    }
  }
  return undefined;
}

function nextContactStep(game: GameState, origin: string, homes: HexState[]) {
  const queue: Array<{ id: string; first?: string; distance: number }> = [{ id: origin, distance: 0 }];
  const visited = new Set([origin]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current.first && homes.some((home) => hexDistance(current.id, home.id) <= 1)) return current.first;
    for (const neighbor of getNeighbors(current.id, mapLibrary[game.mapId])) {
      if (visited.has(neighbor)) continue;
      const hex = game.hexes.find((candidate) => candidate.id === neighbor);
      if (!hex || hex.kind === "rift") continue;
      visited.add(neighbor);
      queue.push({ id: neighbor, first: current.first || neighbor, distance: current.distance + 1 });
    }
  }
  return undefined;
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
  const foundrySeekingContact = factionRules(player) === "foundry" && productionPerTurn(game, playerId).currency === 0;
  const wayfarerSeekingMaterial = factionRules(player) === "wayfarers" && productionPerTurn(game, playerId).material === 0 &&
    player.resources.material < 3;
  const salvoSeekingTargets = factionRules(player) === "salvo" && new Set(player.legacyMetrics.salvoBombardTurns).size < 3 &&
    game.turn <= totalTurns(game) - 4;
  const diplomaticScout = ["aurelians", "meridian"].includes(factionRules(player)) && game.turn <= totalTurns(game) - 3;
  const uncontactedHomes = foundrySeekingContact || wayfarerSeekingMaterial || diplomaticScout || salvoSeekingTargets ? game.hexes.filter((hex) => hex.tier && hex.owner !== undefined &&
    hex.owner !== playerId && !isContacted(game, playerId, hex.owner)) : [];
  for (const explorer of player.explorationVessels.filter((unit) => unit.readyTurn <= game.turn && unit.movesRemaining > 0))
  for (const targetId of getNeighbors(explorer.hex, map)) {
    const target = game.hexes.find((hex) => hex.id === targetId);
    if (!target || target.kind === "rift") continue;
    const frontierRoute = nextUnrevealedStep(game, explorer.hex);
    let score = target.revealed ? frontierRoute?.step === targetId ? 48 - frontierRoute.distance * 4 : -20 :
      33 * profile.priorities.expansion;
    if (target.revealed && target.owner === undefined && economicKinds.includes(target.kind)) score += 14;
    if (!target.revealed) score += objectiveBonus(condition, ["reveal", "unexplored", "survey"]);
    if (!target.revealed && player.colonyShips.some((vessel) => getNeighbors(targetId, map).includes(vessel.hex))) score += 24;
    if (uncontactedHomes.length) {
      if (diplomaticScout || salvoSeekingTargets) {
        const contactStep = nextContactStep(game, explorer.hex, uncontactedHomes);
        if (contactStep === targetId) score += salvoSeekingTargets ? 110 : 150;
      } else {
        const distance = (hex: HexState) => hexDistance(explorer.hex, hex.id);
        const closest = [...uncontactedHomes].sort((a, b) =>
          (factionOutlook(factionRules(game.players[a.owner!])).resource === (foundrySeekingContact ? "currency" : "material") ? -5 : 0) + distance(a) -
          (factionOutlook(factionRules(game.players[b.owner!])).resource === (foundrySeekingContact ? "currency" : "material") ? -5 : 0) - distance(b))[0];
        if (hexDistance(targetId, closest.id) < distance(closest)) score += 52;
      }
    }
    score -= (threat.get(targetId) || 0) * profile.planning.uncertaintyPenalty;
    result.push(candidate(
      { id: `bot-explorer-${explorer.id}-${targetId}`, kind: "explorerMove", vesselId: explorer.id, destination: targetId },
      score,
      [target.revealed ? "Improves exploration position" : "Reveals new strategic information", `Moves from ${explorer.hex} to ${targetId}`],
      [`unit:explorer:${explorer.id}`, `explorer-target:${targetId}`],
    ));
  }
  for (const explorer of player.explorationVessels.filter((unit) => unit.readyTurn <= game.turn && unit.movesRemaining >= 2 && player.tech.Exploration >= 2)) {
    const routes: Array<{ path: string[]; unknown: number }> = [];
    let frontier = [{ at: explorer.hex, path: [] as string[], unknown: 0 }];
    const allowance = Math.max(0, player.tech.Exploration - (explorer.publicReveals || 0));
    for (let distance = 1; distance <= Math.min(explorer.movesRemaining, player.tech.Exploration); distance++) {
      const next: typeof frontier = [];
      for (const route of frontier) for (const id of getNeighbors(route.at, map)) {
        const hex = game.hexes.find((candidate) => candidate.id === id);
        if (!hex || hex.kind === "rift" || id === explorer.hex || route.path.includes(id)) continue;
        const unknown = route.unknown + Number(!hex.revealed);
        if (unknown > allowance) continue;
        const extended = { at: id, path: [...route.path, id], unknown };
        next.push(extended);
        if (distance >= 2 && unknown >= 2) routes.push(extended);
      }
      frontier = next.slice(0, 160);
    }
    for (const route of routes.sort((a, b) => b.unknown - a.unknown || a.path.length - b.path.length).slice(0, 8)) {
      const destination = route.path.at(-1)!;
      result.push(candidate({ id: `bot-explore-route-${explorer.id}-${destination}`, kind: "explorerMove", vesselId: explorer.id, destination, path: route.path },
        39 * profile.priorities.expansion + route.unknown * 24 - route.path.length * 4,
        [`Reveals ${route.unknown} unknown sectors in one Exploration Turn`], [`unit:explorer:${explorer.id}`, `explorer-target:${destination}`]));
    }
  }
  if (factionRules(player) === "farbound" && player.forwardScanUsedTurn !== game.turn)
    for (const vessel of player.explorationVessels.filter((unit) => unit.readyTurn <= game.turn))
      for (const targetId of getNeighbors(vessel.hex, map)) {
        const target = game.hexes.find((hex) => hex.id === targetId);
        if (!target || target.revealed || player.privateSurveys.some((survey) => survey.hexId === targetId)) continue;
        result.push(candidate({ id: `bot-forward-scan-${vessel.id}-${targetId}`, kind: "farboundForwardScan", vesselId: vessel.id, hexId: targetId },
          35 + objectiveBonus(condition, ["survey", "explore"]), ["Privately surveys an adjacent sector while retaining the option to move"],
          ["farbound:forward-scan", `explorer-target:${targetId}`]));
      }
  for (const vessel of player.colonyShips.filter((unit) => unit.readyTurn <= game.turn && unit.movesRemaining > 0)) {
  const colonyRoute = profile.behaviors.routeColonies ? strategicColonyStep(game, playerId, vessel.hex) : undefined;
  const colonyHex = game.hexes.find((hex) => hex.id === vessel.hex);
  const settlementReady = !!colonyHex?.revealed && colonyHex.owner === undefined && economicKinds.includes(colonyHex.kind);
  if (colonyHex && player.modules > 0 && colonyHex.revealed && colonyHex.owner === undefined && economicKinds.includes(colonyHex.kind)) {
    const value = productionValue(game, playerId, colonyHex.kind);
    result.push(candidate(
      { id: `bot-establish-${vessel.id}-${colonyHex.id}`, kind: "establish", vesselId: vessel.id, hexId: colonyHex.id },
      110 + 18 * profile.priorities.expansion + Math.max(18, value) + objectiveBonus(condition, ["habitat", "colon", "expansion"]),
      ["Converts the Colony Ship position into permanent production", `${colonyHex.kind} production supports direct needs, trade leverage, or future Gate costs`],
      [`unit:colony:${vessel.id}`, `settle:${colonyHex.id}`],
    ));
  }

  for (const targetId of getNeighbors(vessel.hex, map)) {
    if (settlementReady) break;
    const target = game.hexes.find((hex) => hex.id === targetId);
    if (!target?.revealed || target.kind === "rift") continue;
    let score = 8;
    if (target.owner === undefined && economicKinds.includes(target.kind))
      score += 18 * profile.priorities.expansion + productionValue(game, playerId, target.kind);
    if (target.owner === playerId) score += 5;
    if (colonyRoute?.first === targetId) score += 36 + colonyRoute.utility;
    score -= (threat.get(targetId) || 0) * 1.2;
    result.push(candidate(
      { id: `bot-colony-${vessel.id}-${targetId}`, kind: "colonyMove", vesselId: vessel.id, destination: targetId },
      score,
        [target.owner === undefined && economicKinds.includes(target.kind) ? `Moves toward ${target.kind} production needed by the long-horizon Gate ledger` : "Repositions toward expansion", ...(colonyRoute?.first === targetId ? ["Follows the shortest revealed route to the highest-value production world"] : [])],
      [`unit:colony:${vessel.id}`],
    ));
  }
  }

  // Faction vessels act independently of Colony Ships. Wayfarers start without
  // one, and Salvo must retain artillery options after settling theirs.
  if (factionRules(player) === "wayfarers") {
    for (const mobile of game.mobileHabitats.filter((unit) => unit.owner === playerId && unit.readyTurn <= game.turn && unit.movesRemaining > 0)) {
      const current = mobileHabitatExtractionResource(game, mobile);
      const income = productionPerTurn(game, playerId);
      if (current === "currency" && player.resources.currency < 3 && income.currency <= 1) continue;
      const currencyRoute = income.currency === 0 ? mobileResourceRoute(game, mobile.hex, "currency") : undefined;
      const materialRoute = income.material === 0 && player.resources.material < 5 ?
        mobileResourceRoute(game, mobile.hex, "material") : undefined;
      for (const targetId of getNeighbors(mobile.hex, map)) {
        const target = game.hexes.find((hex) => hex.id === targetId);
        if (!target?.revealed || target.kind === "rift") continue;
        const resource = economicKinds.includes(target.kind) && target.kind !== "labor" ? target.kind as Resource : null;
        const incomeGain = resource && resource !== current ? productionValue(game, playerId, resource) : 0;
        const currentLoss = current && current !== resource ? productionValue(game, playerId, current) : 0;
        const revisited = player.legacyMetrics.wayfarerMigrationHexes.includes(targetId);
        const needsMigrationProgress = new Set(player.legacyMetrics.wayfarerMigrationHexes).size < 6;
        const firstResource = resource && productionPerTurn(game, playerId)[resource] === 0;
        const score = (needsMigrationProgress ? 35 : -10) + incomeGain * .85 + (firstResource ? 32 : 0) +
          (currencyRoute === targetId ? 90 : 0) + (materialRoute === targetId ? 145 : 0) +
          Math.min(3, mobile.centers.length) * (revisited ? 0 : 18) - currentLoss * .7 - (revisited ? 35 : 0) - (threat.get(targetId) || 0);
        result.push(candidate({ id: `bot-migrate-${mobile.id}-${targetId}`, kind: "migration", mobileHabitatId: mobile.id, destination: targetId }, score,
          [resource ? `Moves the mobile economy toward ${resource} production` : "Repositions the mobile economy", "Advances Wayfarer migration objectives"], [`unit:mobile:${mobile.id}`]));
      }
    }
    if (player.tech.Exploration >= 2 && player.deepReconUsedTurn !== game.turn) {
      const vessel = player.explorationVessels.find((unit) => unit.readyTurn <= game.turn);
      const target = vessel && getNeighbors(vessel.hex, map).map((id) => game.hexes.find((hex) => hex.id === id)).find((hex) => hex && !hex.revealed);
      if (vessel && target) result.push(candidate({ id: `bot-deep-recon-${target.id}`, kind: "wayfarerDeepRecon", vesselId: vessel.id, hexId: target.id }, 38, ["Privately maps the next migration route"], [`unit:explorer:${vessel.id}`]));
    }
  }

  if (factionRules(player) === "salvo") {
    for (const carrier of game.carriers.filter((unit) => unit.owner === playerId && (carrierLibrary[unit.type].bombard || 0) > 0 && unit.readyTurn <= game.turn))
      for (const target of legalBombardmentTargets(game, playerId, carrier.id).filter((target) => target.targetPlayerId !== undefined)) {
        const strength = carrierLibrary[carrier.type].bombard === 2 ? 2 : 1;
        const stationaryGarrison = game.hexes.some((hex) => hex.id === target.hexId && hex.owner === target.targetPlayerId && hex.combat > 1);
        result.push(candidate({ id: `bot-bombard-${carrier.id}-${target.hexId}`, kind: "bombard", carrierId: carrier.id, targetHexId: target.hexId, targetPlayerId: target.targetPlayerId, strength },
          72 * profile.priorities.military + (strength === 2 ? 20 : 0) + (stationaryGarrison ? 25 : 0) +
            (new Set(player.legacyMetrics.salvoBombardTurns).size < 3 ? 55 : 0),
          ["Uses a legal firing opportunity and advances the Salvo combat objectives"], [`unit:carrier:${carrier.id}`]));
      }
  }

  if (factionRules(player) === "aegis") {
    for (const carrier of game.carriers.filter((unit) => unit.owner === playerId && unit.readyTurn <= game.turn && unit.cu > 0)) {
      const cargo = loadedBlockades(game, carrier.id);
      const activeHere = game.blockades.some((blockade) => blockade.active && blockade.hex === carrier.hex);
      if (cargo.length && !activeHere && game.hexes.find((hex) => hex.id === carrier.hex)?.owner === playerId) {
        const blockade = cargo[0];
        result.push(candidate({ id: `bot-blockade-deploy-${blockade.id}`, kind: "blockadeCargo", blockadeId: blockade.id, carrierId: carrier.id, action: "deploy" },
          74 + (threat.get(carrier.hex) || 0) * 2, ["Deploys transported defense in a controlled system"], [`blockade:${blockade.id}`, `unit:carrier:${carrier.id}`]));
      }
      if (cargo.length && carrier.movesRemaining > 0)
        for (const destination of getNeighbors(carrier.hex, map).filter((id) =>
          game.hexes.find((hex) => hex.id === id)?.owner === playerId &&
          !game.blockades.some((item) => item.active && item.hex === id)))
          result.push(candidate({ id: `bot-blockade-escort-${carrier.id}-${destination}`, kind: "carrierMove", carrierIds: [carrier.id], destination },
            61 + (threat.get(destination) || 0) * 2, ["Transports an Aegis Blockade to an unguarded controlled system"], [`unit:carrier:${carrier.id}`]));
      if (cargo.length >= blockadeCargoCapacity(carrier)) continue;
      for (const blockade of game.blockades.filter((item) => item.owner === playerId && item.active && item.readyTurn <= game.turn && item.hex === carrier.hex)) {
        const neighborNeedsCover = getNeighbors(carrier.hex, map).some((id) =>
          game.hexes.find((hex) => hex.id === id)?.owner === playerId &&
          !game.blockades.some((item) => item.active && item.hex === id));
        if (neighborNeedsCover && (threat.get(carrier.hex) || 0) === 0)
          result.push(candidate({ id: `bot-blockade-load-${blockade.id}-${carrier.id}`, kind: "blockadeCargo", blockadeId: blockade.id, carrierId: carrier.id, action: "load" },
            35, ["Loads an Aegis Blockade for redeployment to the neighboring frontier"], [`blockade:${blockade.id}`, `unit:carrier:${carrier.id}`]));
      }
    }
  }

  if (factionRules(player) === "guilds")
    for (const habitat of game.hexes.filter((hex) => hex.owner === playerId && hex.tier))
      habitat.centers.forEach((center, factoryIndex) => {
        if (center !== "factory") return;
        const output = (["material", "currency", "research"] as const).slice()
          .sort((a, b) => productionValue(game, playerId, b) - productionValue(game, playerId, a))[0];
        if (habitat.factoryOutputs?.[factoryIndex] === output || (!habitat.factoryOutputs?.[factoryIndex] && output === "material")) return;
        result.push(candidate({ id: `bot-factory-${habitat.id}-${factoryIndex}-${output}`, kind: "factoryOutput", habitatId: habitat.id, factoryIndex, output },
          32 + productionValue(game, playerId, output) * .4, [`Redirects Factory output toward the current ${output} shortage`], [`factory:${habitat.id}:${factoryIndex}`]));
      });

  const readyByHex = new Map<string, typeof game.carriers>();
  const bombardGoals = factionRules(player) === "salvo" ? game.hexes.filter((hex) => hex.revealed &&
    bombardmentTargetPlayer(game, playerId, hex.id) !== undefined) : [];
  for (const carrier of game.carriers.filter((item) => item.owner === playerId && item.readyTurn <= game.turn && item.movesRemaining > 0 && item.cu > 0)) {
    const group = readyByHex.get(carrier.hex) || [];
    group.push(carrier);
    readyByHex.set(carrier.hex, group);
  }
  for (const [origin, fleet] of readyByHex) {
    const strength = fleet.reduce((sum, carrier) => sum + carrier.cu, 0), ids = fleet.map((carrier) => carrier.id);
    const sharedMovement = Math.min(...fleet.map((carrier) => carrier.movesRemaining));
    if (sharedMovement > 1) for (const target of game.hexes.filter((hex) => hex.revealed && hex.tier && hex.owner !== undefined && hex.owner !== playerId && hexDistance(origin, hex.id) <= sharedMovement)) {
      if (hasBenefit(game, playerId, target.owner!, "nonAggression") || hasBenefit(game, playerId, target.owner!, "openBorders")) continue;
      const path = shortestPath(origin, target.id, map, (id, final) => game.hexes.some((hex) => hex.id === id && hex.revealed && hex.kind !== "rift" && (final || hex.owner === undefined || hex.owner === playerId)) &&
        (final || !game.carriers.some((carrier) => carrier.hex === id && carrier.owner !== playerId)));
      if (path.length < 2 || path.length > sharedMovement) continue;
      const defense = target.combat + (target.centers.includes("defense") ? 3 : 1) + game.carriers.filter((carrier) => carrier.hex === target.id && carrier.owner !== playerId).reduce((sum, carrier) => sum + carrier.cu, 0);
      if (strength <= defense) continue;
      result.push(candidate({ id: `bot-fast-strike-${origin}-${target.id}`, kind: "carrierMove", carrierIds: ids, destination: target.id, path },
        58 * profile.priorities.military + 24 * profile.priorities.denial + (strength - defense) * 4 - path.length * 5,
        [`Uses Military mobility to strike ${target.id} in ${path.length} steps`, `Forecast ${strength} CU against ${defense} defense`],
        ids.map((id) => `unit:carrier:${id}`)));
    }
    const artillery = fleet.some((carrier) => (carrierLibrary[carrier.type].bombard || 0) > 0);
    const canBombardHere = artillery && fleet.some((carrier) => (carrierLibrary[carrier.type].bombard || 0) > 0 &&
      legalBombardmentTargets(game, playerId, carrier.id).some((target) => target.targetPlayerId !== undefined));
    const salvoRange = player.tech.Military >= 4 ? 7 : player.tech.Military >= 3 ? 4 : player.tech.Military >= 2 ? 2 : 1;
    const firingRoute = artillery && !canBombardHere ? bombardGoals.flatMap((goal) => game.hexes.filter((station) => station.revealed && hexDistance(goal.id, station.id) >= 1 && hexDistance(goal.id, station.id) <= salvoRange).flatMap((candidateHex) => {
      const station = candidateHex.id;
      const safe = game.hexes.find((hex) => hex.id === station && hex.revealed &&
        (hex.owner === undefined || hex.owner === playerId) &&
        !game.carriers.some((carrier) => carrier.hex === station && carrier.owner !== playerId));
      if (!safe || station === origin) return [];
      const path = shortestPath(origin, station, map, (id) => game.hexes.some((hex) => hex.id === id && hex.revealed &&
        (hex.owner === undefined || hex.owner === playerId)) &&
        !game.carriers.some((carrier) => carrier.hex === id && carrier.owner !== playerId));
      return path.length ? [{ station, target: goal.id, path }] : [];
    })).sort((a, b) => a.path.length - b.path.length || a.target.localeCompare(b.target))[0] : undefined;
    // Advanced Military mobility reaches a firing position in one Turn.
    if (firingRoute) for (const vessel of fleet.filter((carrier) =>
      carrier.type === "bombardFrigate" && carrier.movesRemaining >= firingRoute.path.length)) {
      result.push(candidate({ id: `bot-fast-artillery-${vessel.id}-${firingRoute.station}`, kind: "carrierMove",
        carrierIds: [vessel.id], destination: firingRoute.station, path: firingRoute.path },
      185 - firingRoute.path.length * 9,
      [`Positions ${vessel.id} to bombard ${firingRoute.target} next Turn`], [`unit:carrier:${vessel.id}`]));
    }
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
        if (canBombardHere) score -= 95;
        if (artillery && !firingRoute) {
          const lead = fleet.find((carrier) => (carrierLibrary[carrier.type].bombard || 0) > 0);
          if (lead?.lastHex === targetId) score -= 145;
          const frontier = getNeighbors(targetId, map).filter((id) =>
            !game.hexes.find((hex) => hex.id === id)?.revealed).length;
          score += frontier * 12;
        }
        if (firingRoute) {
          if (targetId === firingRoute.path[0]) {
            score += 165 + (firingRoute.path.length === 1 ? 45 : 0);
            reasons.push(`Moves artillery toward a firing hex adjacent to ${firingRoute.target} (${firingRoute.path.length} steps)`);
          } else score -= 48;
        }
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
      if (hostile && strength > defense && fleet.length > 1) {
        const strike: typeof fleet = [];
        let strikeStrength = 0;
        for (const carrier of [...fleet].sort((a, b) => b.cu - a.cu || a.id.localeCompare(b.id))) {
          strike.push(carrier);
          strikeStrength += carrier.cu;
          if (strikeStrength > defense) break;
        }
        if (strike.length < fleet.length) {
          const strikeIds = strike.map((carrier) => carrier.id);
          const retained = strength - strikeStrength;
          const responsePenalty = Math.max(0, responseThreat - strikeStrength) * (1.45 - profile.planning.riskTolerance);
          result.push(candidate(
            { id: `bot-strike-${origin}-${targetId}`, kind: "carrierMove", carrierIds: strikeIds, destination: targetId },
            score + retained * 4 * profile.priorities.survival - responsePenalty,
            [
              `Efficient task force commits ${strikeStrength} CS against ${defense} CS`,
              `Retains ${retained} CS at ${origin} for defense or a second operation`,
            ],
            strikeIds.map((id) => `unit:carrier:${id}`),
            `A larger commitment remains available if ${responseThreat} CS of public counterforce is judged likely.`,
          ));
        }
      }
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
        ["Uses the Surveyor's global private survey reach", "Creates long-lived information and settlement value"],
        [`unit:civilian:${unit.id}`],
      ));
    }
    for (const targetId of getNeighbors(unit.hex, map)) {
      const target = game.hexes.find((hex) => hex.id === targetId);
      if (!target?.revealed || target.kind === "rift" || unit.movesRemaining < 1) continue;
      if (unit.type === "envoy" && target.owner !== undefined && target.owner !== playerId &&
          !hasStationingPermission(game, target.owner, playerId, "envoy")) continue;
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
    const colonyHex = game.hexes.find((hex) => player.colonyShips.some((vessel) => vessel.hex === hex.id) && hex.revealed && hex.owner === undefined && economicKinds.includes(hex.kind));
    if (player.modules === 0 && colonyHex?.revealed && colonyHex.owner === undefined && economicKinds.includes(colonyHex.kind)) {
      score += 335;
      reasons.push("Colony Ship is waiting on a settlement site; replace its Module before moving again");
    }
    reasons.push(player.modules === 0 ? "Restores the ability to establish another Habitat" : "Banks future expansion capacity");
  } else if (construction.type === "colony") {
    const frontier = game.hexes.filter((hex) => hex.revealed && hex.owner === undefined && economicKinds.includes(hex.kind));
    const uncovered = frontier.filter((hex) => !player.colonyShips.some((vessel) => vessel.hex === hex.id || getNeighbors(vessel.hex, mapLibrary[game.mapId]).includes(hex.id)));
    score = !player.colonyShips.length ? 100 :
      player.colonyShips.length < 3 && game.turn <= 8 && player.modules > 0 && uncovered.length >= 3
        ? 22 * profile.priorities.expansion : -100;
    reasons.push(!player.colonyShips.length ? "Restores settlement capability" : "Opens a second expansion route while preserving resources for the Gate");
  } else if (construction.type === "upgrade") {
    score = 36 * profile.priorities.expansion + (habitat.tier === "Colony" ? 12 : 0) + objectiveBonus(condition, ["upgrade", "metropolis", "colon"]);
    if (factionRules(player) === "spires" && player.tech.Resource >= 2) {
      const metros = game.hexes.filter((hex) => hex.owner === playerId && (hex.tier === "Metropolis" || hex.tier === "Arcology")).length;
      if (habitat.tier === "Colony" && metros < (player.tech.Resource >= 4 ? 3 : 1)) score += 190;
      else if (habitat.tier === "Outpost" && game.hexes.filter((hex) => hex.owner === playerId && hex.tier !== "Outpost").length < 2) score += 130;
      const income = productionPerTurn(game, playerId);
      if (habitat.tier === "Outpost" && income.material < 2 && habitat.centers.length >= 1) score += 570;
      if (habitat.tier === "Colony" && player.tech.Resource >= 3 &&
          (income.material < 3 || income.research < 2) && habitat.centers.length >= 2) score += 480;
    }
    reasons.push("Raises production resilience and Center capacity");
  } else if (construction.type === "center") {
    score = 20 * profile.priorities.economy;
    const center = construction.center;
    if (center === "defense") {
      score += danger * 7 * profile.priorities.survival;
      reasons.push(danger > 0 ? "Threat map identifies this Habitat as exposed" : "Adds permanent defensive strength");
    } else if (center === "factory") {
      score = -100;
      reasons.push("Factories use the Guild construction action");
    } else {
      const scarcity = center === "labor" ? Math.max(0, 5 - player.laborCap) : Math.max(0, 4 - player.resources[center]);
      score += scarcity * 4;
      if (factionRules(player) === "helix" && center === "research") score += 20;
      if (factionRules(player) === "spires" && player.tech.Resource < 4) {
        const income = productionPerTurn(game, playerId);
      if (center === "research" && income.research < 3) score += income.research === 0 ? 500 : income.research < 2 ? 260 : 95;
      if (center === "material" && income.material < 3) score += income.material === 0 ? 500 : income.material < 2 ? 750 : 120;
      if (center === "research" && income.research >= 1 && income.material < 2) score -= 700;
        if (center === "currency" && income.currency < 2) score += 75;
        if (!(["research", "material", "currency"] as string[]).includes(center) &&
            (income.research < 2 || income.material < 2) &&
            !(center === "influence" && game.era >= 3 && income.influence === 0)) score -= 160;
      }
      if (factionRules(player) === "foundry" && center === "material") score += 16;
      if (center === "currency" && needsCurrencyCenter(game, playerId) && game.turn <= totalTurns(game) - 3) {
        score += factionRules(player) === "foundry" ? 235 : 185;
        reasons.push("First Currency Center turns scarce Currency into recurring construction and Gate income");
      }
      if (factionRules(player) === "aurelians" && center === "influence") score += 16;
      if (factionRules(player) === "meridian" && center === "currency") score += 16;
      if (["aurelians", "meridian"].includes(factionRules(player)) &&
          (center === "material" || center === "currency") && productionPerTurn(game, playerId)[center] === 0)
        score += 42;
      if (["material", "currency", "research", "influence"].includes(center))
        score += productionValue(game, playerId, center) * 0.7;
      if (center === "influence" && player.resources.influence < 2 &&
          game.players.some((candidate) => candidate.id !== playerId && isContacted(game, playerId, candidate.id) &&
            !tradeEligibility(game, playerId, candidate.id).ok)) score += 34 * profile.priorities.diplomacy;
      reasons.push(`Improves recurring ${center} production and relieves a projected constraint`);
    }
    score += objectiveBonus(condition, ["center", "produce", String(construction.center)]);
  } else if (construction.type === "recruit") {
    score = 16 + construction.pairs * 8 * profile.priorities.military + danger * 8;
    if (factionRules(player) === "spires" && player.tech.Resource < 4 && danger < 3)
      score -= 420;
    if (factionRules(player) === "wayfarers" &&
        !game.mobileHabitats.some((mobile) => mobile.owner === playerId && mobile.centers.includes("currency")) &&
        player.resources.currency < 3 && danger < 4) score -= 100;
    reasons.push(danger > 0 ? "Adds next-Turn defense where the threat map is strongest" : "Expands deterministic combat capacity");
    score += objectiveBonus(condition, ["recruit", "combat", "cu"]);
  } else if (construction.type === "carrier") {
    const definition = carrierLibrary[construction.carrier];
    score = 13 + definition.capacity * 1.8 + definition.move * 4;
    if (factionRules(player) === "varkesh") score += 14;
    if (factionRules(player) === "spires" && player.tech.Resource < 4 && danger < 3) score -= 260;
    reasons.push(`Adds ${definition.capacity} Capacity and ${definition.move} movement potential`);
    score += objectiveBonus(condition, ["vessel", "combat", "arsenal"]);
  } else if (construction.type === "exploration") {
    score = player.explorationVessels.length ? 25 : 395;
    reasons.push(player.explorationVessels.length ? "Expands scouting capacity" : "Restores lost exploration capability");
  } else if (construction.type === "mobileCenter") {
    const mobile = game.mobileHabitats.find((candidate) => candidate.id === construction.mobileHabitatId)!;
    const output = construction.center;
    score = 62 * profile.priorities.economy + (output === "labor" ? Math.max(0, 5 - player.laborCap) * 5 :
      productionValue(game, playerId, output) * .65);
    if (mobile.centers.includes(output)) score -= 24;
    if (factionRules(player) === "wayfarers" && (output === "material" || output === "currency") &&
      productionPerTurn(game, playerId)[output] < 2) score += 95;
    if ((output === "material" || output === "currency") && productionPerTurn(game, playerId)[output] === 0) score += 48;
    if (output !== "currency" && !game.mobileHabitats.some((candidate) => candidate.owner === playerId && candidate.centers.includes("currency")) &&
        player.resources.currency < 3) score -= 90;
    reasons.push(`Adds recurring ${output} production aboard a mobile Habitat`);
  } else if (construction.type === "mobileHabitat") {
    const fleet = game.mobileHabitats.filter((mobile) => mobile.owner === playerId);
    score = fleet.length === 1 ? 134 : fleet.some((mobile) => mobile.centers.length < mobileHabitatLibrary[mobile.type].slots) ? 24 : 56;
    if (fleet.length === 1) score += productionPerTurn(game, playerId).material > 0 &&
      productionPerTurn(game, playerId).currency > 0 ? 95 : -65;
    reasons.push("Expands mobile settlement capacity after developing the existing caravan");
  } else if (construction.type === "blockade") {
    score = (game.blockades.some((blockade) => blockade.owner === playerId) ? 34 : 260) + danger * 9 * profile.priorities.survival;
    reasons.push("Establishes an Aegis defensive asset at a controlled Habitat");
  } else if (construction.type === "caravanGuard") {
    score = 22 + danger * 9 * profile.priorities.survival;
    reasons.push("Protects a threatened Habitat or caravan route");
  } else if (construction.type === "arcology") {
    score = 345 + objectiveBonus(condition, ["arcology", "metropolis", "habitat"]);
    reasons.push("Completes the Spires urban upgrade path");
  } else if (construction.type === "factory" || construction.type === "enhanceCenter") {
    score = construction.type === "factory" ? 55 : 40;
    reasons.push("Develops the Guilds specialized production network");
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
      { type: "module" }, { type: "upgrade" }, { type: "colony" },
      ...centers.map((center) => ({ type: "center" as const, center })),
      ...[1, 2, 3].map((pairs) => ({ type: "recruit" as const, pairs })),
      ...availableCarrierTypes(player).map((carrier) => ({ type: "carrier" as const, carrier })),
      ...(player.explorationVessels.length ? [] : availableExplorationTypes(game, playerId).map((vessel) => ({ type: "exploration" as const, vessel }))),
    ];
    if (factionRules(player) === "spires") options.push({ type: "arcology" });
    if (factionRules(player) === "aegis") options.push({ type: "blockade" });
    if (factionRules(player) === "wayfarers") {
      options.push({ type: "mobileHabitat", vessel: "arkship" }, { type: "mobileHabitat", vessel: "grandArk" }, { type: "mobileHabitat", vessel: "worldship" });
    }
    if (factionRules(player) === "guilds") {
      options.push({ type: "factory" });
      habitat.centers.forEach((center, centerIndex) => { if (!["labor", "defense", "factory"].includes(center)) options.push({ type: "enhanceCenter", centerIndex }); });
    }
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
  if (factionRules(player) === "wayfarers") for (const mobile of game.mobileHabitats.filter((unit) => unit.owner === playerId && unit.deployed && unit.constructionUsedTurn !== game.turn)) {
    const options: Construction[] = [
      ...(["material", "currency", "research", "influence", "labor"] as const).map((center) => ({ type: "mobileCenter" as const, mobileHabitatId: mobile.id, center })),
      { type: "caravanGuard", mobileHabitatId: mobile.id },
    ];
    for (const construction of options) {
      const quote = constructionQuote(game, playerId, mobile.hex, construction);
      if (!quote.available) continue;
      const order: SecretOrder = { id: `bot-mobile-build-${mobile.id}-${construction.type === "mobileCenter" ? construction.center : "guard"}`, kind: "construct", habitatId: mobile.hex, construction };
      if (projectedOrderBudget(game, playerId, [order]).error) continue;
      const habitat = game.hexes.find((hex) => hex.id === mobile.hex)!;
      const danger = Math.max(0, (threats.find((entry) => entry.hex.id === mobile.hex)?.threat || 0) - defenseAt(game, playerId, habitat));
      const assessment = constructionScore(game, playerId, habitat, construction, profile, danger);
      result.push(candidate(order, assessment.score, assessment.reasons, [`unit:mobile:${mobile.id}`]));
    }
  }
  for (const branch of branches) {
    const quote = technologyQuote(game, playerId, branch);
    if (!quote.available) continue;
    const order: SecretOrder = { id: `bot-tech-${branch.toLowerCase()}`, kind: "technology", branch };
    if (projectedOrderBudget(game, playerId, [order]).error) continue;
    let score = 24 * profile.priorities.technology * profile.technology[branch] + (4 - player.tech[branch]) * 3;
    if (factionRules(player) === "wayfarers" && branch === "Resource" && player.tech.Resource < 2 &&
        game.mobileHabitats.filter((mobile) => mobile.owner === playerId).length === 1) score += 68;
    if (factionRules(player) === "spires" && branch !== "Resource" && player.tech.Resource < 4) score -= 340;
    if (factionRules(player) === "spires" && branch === "Resource" && player.tech.Resource < 4) {
      const income = productionPerTurn(game, playerId);
      score += income.material >= 1 && income.research >= 1 ? 340 : 150;
      if (player.tech.Resource >= 2 && income.material < 2 && game.turn < totalTurns(game) - 3)
        score -= 350;
    }
    if (factionRules(player) === "wayfarers" && branch === "Exploration" && player.tech.Exploration < 2 &&
        game.mobileHabitats.filter((mobile) => mobile.owner === playerId).length >= 2) score += 100;
    const reasons = [`Advances ${branch} from ${player.tech[branch]} to ${player.tech[branch] + 1}`];
    if (factionRules(player) === "spires" && branch === "Resource")
      reasons.push(`Resource ${player.tech.Resource + 1} is a step toward Resource IV and Arcologies`);
    if (factionRules(player) === "varkesh" && branch === "Military") score += 20;
    if (factionRules(player) === "helix") score += branch === "Resource" || branch === "Military" ? 9 : 13;
    if (factionRules(player) === "foundry" && ["Resource", "Exploration"].includes(branch)) score += 18;
    if (factionRules(player) === "aurelians" && branch === "Policy") score += 18;
    if (factionRules(player) === "meridian" && branch === "Economy") score += 18;
    if (factionRules(player) === "aegis" && branch === "Economy" && player.tech.Economy < 2) {
      score += 105;
      reasons.push("Economy II unlocks Blockade commissions without a Military prerequisite");
    }
    if (factionRules(player) === "farbound" && ["Exploration", "Policy"].includes(branch)) score += 18;
    score += objectiveBonus(hiddenCondition(game, playerId), ["technology", branch.toLowerCase()]);
    reasons.push("Faction capability ledger and objective forecast favor this branch");
    result.push(candidate(order, score, reasons, ["technology"]));
  }
  return result;
}

function gateCandidates(game: GameState, playerId: number, profile: BotProfile, plan: BotStrategicPlan) {
  const player = game.players[playerId], result: BotCandidate[] = [], target = gateTarget(game), remaining = Math.max(0, target - game.gate);
  if (!remaining) return result;
  const turnsRemaining = totalTurns(game) + 1 - game.turn, expectedShare = Math.max(0, finalEra(game) - 1 - player.tributes), behindPace = remaining / Math.max(1, turnsRemaining);
  const eraLastTurn = game.turn % 4 === 0, finalPressure = game.era === finalEra(game) ? (game.turn - (finalEra(game) - 1) * 4) / 4 : 0;
  const selected = hiddenCondition(game, playerId), objectiveNeed = selected.includes("tribute");
  const production = productionPerTurn(game, playerId);
  // Spires begin with only Currency income. Spending their sole Material on
  // the first Tribute before any production route exists locks Resource IV out.
  // The Era I Tribute remains available in Turns 3 and 4.
  if (factionRules(player) === "spires" && game.era < finalEra(game) && game.turn < game.era * 4 &&
      (production.material < 2 || production.research < 1)) return result;
  const bootstrap = game.turn < game.era * 4 &&
    (factionRules(player) === "aurelians" && production.influence < 2 && player.resources.currency <= 1 ||
      production.currency === 0 && player.resources.currency >= 2 && player.resources.currency <= 3 ||
      factionRules(player) === "spires" && game.era === 1 &&
        (production.material === 0 || production.research === 0));
  const currencyBootstrap = needsCurrencyCenter(game, playerId) &&
    game.turn <= totalTurns(game) - 3 && game.turn < game.era * 4 &&
    game.hexes.some((hex) => hex.owner === playerId && hex.tier &&
      constructionQuote(game, playerId, hex.id, { type: "center", center: "currency" }).available);
  const scheduledGate = target * game.turn / totalTurns(game);
  const gateShortfall = Math.max(0, scheduledGate - game.gate);
  const count = game.era === finalEra(game) ? Math.min(remaining, Math.max(1, plan.personalContributionTarget)) : player.eraTributes[game.era - 1] ? 0 : 1;
  for (let index = 0; index < count; index++) {
    const order: SecretOrder = { id: `bot-tribute-${index}`, kind: "tribute" };
    const existing = result.map((entry) => entry.order);
    if (projectedOrderBudget(game, playerId, [...existing, order]).error) break;
    let score = 42 + behindPace * 24 * profile.priorities.gate + finalPressure * 90;
    if (bootstrap && game.era < finalEra(game) && game.turn < game.era * 4 - 1) score -= 160;
    if (currencyBootstrap && game.era < finalEra(game)) score -= 225;
    if (game.era < finalEra(game) && index === 0 && !bootstrap &&
        resourcesForGate.every((resource) => player.resources[resource] >= (tributeCosts[game.era][resource] || 0)))
      score += 115 * profile.priorities.gate;
    if (objectiveNeed) score += 28 * profile.priorities.legacy;
    if (eraLastTurn) score += 120 * profile.priorities.survival;
    if (game.turn === totalTurns(game)) score += 250;
    if (profile.behaviors.punishFreeRiders && !eraLastTurn && game.era < finalEra(game) && gateShortfall === 0) score -= 12;
    result.push(candidate(
      order,
      score,
      [game.turn === totalTurns(game) ? "Collective survival overrides all optional spending" : "Gate pace model identifies a contribution obligation", `Personal remaining fair-share estimate is ${expectedShare}`],
      game.era < finalEra(game) ? ["tribute"] : [],
    ));
  }
  return result;
}

type BeamState = { candidates: BotCandidate[]; orders: SecretOrder[]; conflicts: Set<string>; score: number; utility: number };

function reservePenalty(game: GameState, playerId: number, profile: BotProfile, orders: SecretOrder[], plan: BotStrategicPlan) {
  const availableModules = game.players[playerId].modules + orders.filter(
    (order) => order.kind === "construct" && order.construction.type === "module",
  ).length;
  if (orders.filter((order) => order.kind === "establish").length > availableModules)
    return { valid: false, penalty: 1000 };
  const budget = projectedOrderBudget(game, playerId, orders);
  if (budget.error) return { valid: false, penalty: 1000 };
  const player = game.players[playerId];
  const includesTribute = orders.some((order) => order.kind === "tribute");
  const production = productionPerTurn(game, playerId);
  const turnsUntilDue = Math.max(0, plan.contributionDueTurn - game.turn);
  const currencyBootstrap = needsCurrencyCenter(game, playerId) &&
    game.turn <= totalTurns(game) - 3 && game.turn < game.era * 4 &&
    game.hexes.some((hex) => hex.owner === playerId && hex.tier &&
      constructionQuote(game, playerId, hex.id, { type: "center", center: "currency" }).available);
  // Early Tributes can wait until the Era deadline. Spending the first
  // Currency now can permanently prevent a Currency-poor civilization from
  // reaching the two required for recurring income.
  if (currencyBootstrap && player.resources.currency < 2 && includesTribute)
    return { valid: false, penalty: 1000 };
  if (currencyBootstrap && player.resources.currency < 2 &&
      budget.remaining.resources.currency < player.resources.currency &&
      orders.some((order) => order.kind === "technology" || order.kind === "construct" &&
        !(order.construction.type === "center" && order.construction.center === "currency")))
    return { valid: false, penalty: 1000 };
  if (factionRules(player) === "aurelians" && game.turn >= 5 && game.turn <= 8 &&
      production.currency === 0 && player.resources.currency > 0 && player.resources.currency < 2 &&
      budget.remaining.resources.currency < player.resources.currency && !includesTribute &&
      orders.some((order) => order.kind === "technology" || order.kind === "construct" &&
        !(order.construction.type === "center" && order.construction.center === "currency")))
    return { valid: false, penalty: 1000 };
  const newProduction: Partial<Record<Resource, number>> = {};
  for (const order of orders) if (order.kind === "construct" && order.construction.type === "center" &&
      ["material", "currency", "research", "influence"].includes(order.construction.center)) {
    const resource = order.construction.center as Resource;
    newProduction[resource] = (newProduction[resource] || 0) + 1;
  }
  const aurelianInvestment = factionRules(player) === "aurelians" && turnsUntilDue >= 2 &&
    orders.some((order) => order.kind === "construct" && order.construction.type === "center" && order.construction.center === "influence");
  if (profile.behaviors.protectGateCompletion && !includesTribute &&
      !player.eraTributes[game.era - 1] && game.gate < gateTarget(game)) {
    const gateCost = tributeCosts[game.era];
    let convertibleShortage = 0;
    for (const [key, required] of Object.entries(gateCost)) {
      const before = key === "labor" ? player.labor : player.resources[key as Resource];
      const after = key === "labor" ? (turnsUntilDue ? player.laborCap : budget.remaining.labor) :
        budget.remaining.resources[key as Resource] + (production[key as Resource] + (newProduction[key as Resource] || 0)) * turnsUntilDue;
      const shortage = Math.max(0, Math.min(before, required) - after);
      if (shortage && aurelianInvestment && (key === "material" || key === "currency")) convertibleShortage += shortage;
      else if (shortage) return { valid: false, penalty: 1000 };
    }
    // A new Influence Center produces next Turn. Aurelians may convert that
    // income into missing Gate inputs before the Era's last Turn.
    if (convertibleShortage > Math.floor(Math.max(0, budget.remaining.resources.influence +
      (production.influence + 1) * (turnsUntilDue - 1) - (gateCost.influence || 0)) / 2))
      return { valid: false, penalty: 1000 };
  }
  const reserve = Math.max(0, profile.planning.reserveByEra[game.era - 1]);
  let addedShortage = Math.max(0, reserve - budget.remaining.labor) - Math.max(0, reserve - player.labor);
  for (const resource of ["material", "currency", "research"] as Resource[])
    addedShortage += Math.max(0, reserve - budget.remaining.resources[resource]) -
      Math.max(0, reserve - player.resources[resource]);
  const strategicReserve = includesTribute ? plan.followupReserve : plan.reserve;
  let strategicShortage = 0;
  for (const resource of ["material", "currency", "research", "influence"] as Resource[]) {
    const income = (production[resource] + (newProduction[resource] || 0)) * turnsUntilDue;
    const beforeShortage = Math.max(0, strategicReserve[resource] - player.resources[resource] - income);
    const afterShortage = Math.max(0, strategicReserve[resource] - budget.remaining.resources[resource] - income);
    strategicShortage += Math.max(0, afterShortage - beforeShortage);
  }
  const remainingTurns = Math.max(0, totalTurns(game) - game.turn);
  const draftedTributes = orders.filter((order) => order.kind === "tribute").length;
  let cumulativeShortage = 0;
  for (const resource of ["material", "currency", "research", "influence"] as Resource[]) {
    const demand = Math.max(0, plan.gateDemand[resource] - draftedTributes * (tributeCosts[game.era][resource] || 0));
    const before = Math.max(0, plan.gateDemand[resource] - player.resources[resource] - production[resource] * .75 * remainingTurns);
    const after = Math.max(0, demand - budget.remaining.resources[resource] -
      (production[resource] + (newProduction[resource] || 0)) * .75 * remainingTurns);
    cumulativeShortage += Math.max(0, after - before);
  }
  const deadlinePressure = Math.max(1, 5 - Math.max(0, plan.contributionDueTurn - game.turn));
  const hiddenId = player.hiddenLegacy[game.era]?.selected;
  const eraIncomeTurns = Math.max(0, game.era * 4 - game.turn);
  const researchFloor = ["h1-specialist", "h3-tech"].includes(hiddenId || "") ? 2 : hiddenId === "h5-science" ? 3 : 0;
  const researchIncome = production.research * eraIncomeTurns;
  const researchRisk = Math.max(0, researchFloor - budget.remaining.resources.research - researchIncome) -
    Math.max(0, researchFloor - player.resources.research - researchIncome);
  const stockFloor = ["h4-economy", "h5-reserve"].includes(hiddenId || "") ? 10 : 0;
  const resourceStock = (stock: Record<Resource, number>) => stock.material + stock.currency + stock.research;
  const stockIncome = (production.material + production.currency + production.research) * eraIncomeTurns;
  const stockRisk = Math.max(0, stockFloor - resourceStock(budget.remaining.resources) - stockIncome) -
    Math.max(0, stockFloor - resourceStock(player.resources) - stockIncome);
  const activeProject = plan.projectPlan.projects[0];
  let projectShortage = 0;
  if (activeProject && game.turn < activeProject.deadline - 1 &&
      !orders.some((order) => projectOrderBonus(game, playerId, order, [activeProject]).score > 0)) {
    for (const resource of ["material", "currency", "research"] as const) {
      const need = activeProject.next.cost[resource] || 0;
      if (!need || production[resource] > 0) continue;
      const before = Math.max(0, need - player.resources[resource]);
      const after = Math.max(0, need - budget.remaining.resources[resource]);
      projectShortage += Math.max(0, after - before);
    }
  }
  return { valid: true, penalty: Math.max(0, addedShortage) * 12 * profile.priorities.survival +
    strategicShortage * 18 * deadlinePressure + cumulativeShortage * 34 * profile.priorities.gate +
    Math.max(0, researchRisk) * 100 + Math.max(0, stockRisk) * 80 + projectShortage * 28 };
}

function selectBundle(game: GameState, playerId: number, profile: BotProfile, candidates: BotCandidate[], plan: BotStrategicPlan) {
  const ranked = candidates
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || stableNoise(game.seed + game.turn + playerId, a.id) - stableNoise(game.seed + game.turn + playerId, b.id))
    .slice(0, profile.planning.candidateLimit);
  let beam: BeamState[] = [{ candidates: [], orders: [], conflicts: new Set(), score: 0, utility: 0 }], nodes = 1;
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
        utility: state.utility + option.score,
        score: state.utility + option.score - budget.penalty,
      });
    }
    beam = expanded.sort((a, b) => b.score - a.score || a.orders.length - b.orders.length).slice(0, profile.planning.beamWidth);
  }
  return { best: beam[0], ranked, nodes };
}

function assessment(entry: BotCandidate): BotOrderAssessment {
  return { label: orderLabel(entry.order), score: Math.round(entry.score * 10) / 10, reasons: [...entry.reasons, ...(entry.counterfactual ? [entry.counterfactual] : [])] };
}

function posture(game: GameState, playerId: number, threats: ReturnType<typeof threatSummary>, memory?: BotMemoryState) {
  const player = game.players[playerId], leader = Math.max(...game.players.map((candidate) => candidate.lp));
  if (game.turn >= totalTurns(game) - 2 && game.gate < gateTarget(game)) return "Gate stabilization with selective scoring";
  if (threats.some((entry) => entry.threat > entry.defense)) return "Defensive consolidation and counter-positioning";
  if (memory?.opponents.some((opponent) => opponent.stance === "contain")) return "Legacy acceleration with targeted leader containment";
  if (player.lp < leader) return "Efficient Legacy acceleration and leader denial";
  if (factionRules(player) === "varkesh") return "Controlled force projection";
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
  if (profile.behaviors.multiTurnPlanning || profile.difficulty === "easy") for (const option of all) {
    if (profile.difficulty === "easy" && option.order.kind !== "tribute") continue;
    const modifier = strategicOrderModifier(privateGame, playerId, option.order, strategicPlan);
    option.score += modifier.score;
    option.reasons.push(...modifier.reasons);
  }
  const selected = selectBundle(privateGame, playerId, profile, all, strategicPlan), chosen = selected.best.candidates;
  const chosenIds = new Set(chosen.map((entry) => entry.id));
  const rejected = selected.ranked.filter((entry) => !chosenIds.has(entry.id)).slice(0, 4);
  const target = gateTarget(game), remaining = Math.max(0, target - game.gate), turnsRemaining = totalTurns(game) + 1 - game.turn;
  const confidence = Math.max(0.35, Math.min(0.96, 0.88 - threats.length * 0.035 - profile.planning.uncertaintyPenalty * 0.08));
  const report: BotDecisionReport = {
    id: `bot-report-${game.turn}-${playerId}-${game.botReports.length}`,
    turn: game.turn,
    era: game.era,
    playerId,
    profileId: profile.id,
    profileName: profile.name,
    posture: posture(privateGame, playerId, threats, memory),
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
    opponentModels: (memory?.opponents || []).sort((a, b) => b.victoryThreat - a.victoryThreat).slice(0, 3)
      .map((model) => `${privateGame.players[model.playerId].name}: ${model.stance}; public faction forecast ${factionOutlook(factionRules(privateGame.players[model.playerId])).resource}/${factionOutlook(factionRules(privateGame.players[model.playerId])).technology}, threat ${model.victoryThreat.toFixed(1)}, public ${model.lp} LP, plausible scored range ${model.scoreFloor}-${model.scoreCeiling} LP (${model.lpTrend >= 0 ? "+" : ""}${model.lpTrend}), resource fit ${model.tradeFit.toFixed(1)}, dependency ${model.dependencyRisk.toFixed(1)}, ${model.military} CS, Gate reliability ${Math.round(model.gateReliability * 100)}%, trade reliability ${Math.round(model.tradeReliability * 100)}%`),
    commitments: (memory?.commitments || []).filter((commitment) => commitment.status !== "expired").slice(-4)
      .map((commitment) => `${commitment.status}: ${commitment.detail}`),
    metaFlags: memory?.metaFlags || [],
    strategicForecast: [
      strategicPlan.doctrine,
      `Projected Gate capacity: ${strategicPlan.collectiveProjectedTributes}/${target} (${Math.round(strategicPlan.gateConfidence * 100)}% confidence).`,
      `Personal target: ${strategicPlan.personalContributionTarget} more Tributes; next deadline Turn ${strategicPlan.contributionDueTurn}.`,
      `Priority resources: ${strategicPlan.priorityResources.join(", ")}.`,
      `Current priorities: ${strategicPlan.priorities.slice(0, 5).map((priority) => `${priority.key} ${priority.weight} (${priority.reason})`).join("; ")}.`,
      ...strategicPlan.projectPlan.projects.map((project) =>
        `Project ${project.name}: next ${project.next.label}; total budget ${Object.entries(project.budget.required).filter(([, amount]) => amount > 0).map(([resource, amount]) => `${amount} ${resource}`).join(", ") || "none"}, ${project.budget.labor} Labor and at least ${project.budget.minimumTurns} actions; shortages ${Object.entries(project.missing).map(([resource, amount]) => `${amount} ${resource} via ${project.route[resource as Resource]}`).join(", ") || "none"}; deadline Turn ${project.deadline}.`),
      `Anticipated garrison needs: ${Object.entries(strategicPlan.defenseNeeds).map(([hex, count]) => `${hex} +${count} CU`).join(", ") || "none"}.`,
    ],
    goalAnalysis: strategicPlan.objectivePlan.goals.map((goal) =>
      `${goal.category}: ${goal.name} ${goal.progress}/${goal.target}, ${Math.round(goal.feasibility * 100)}% feasible, score ${goal.score.toFixed(1)}`),
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
  if (game.orderProtocol.phase === "negotiation") {
    game.orderProtocol.phase = "orders";
    game.orderProtocol.currentPlayer = playerId;
    game.active = playerId;
  }
  if (game.orderProtocol.phase !== "orders" || game.orderProtocol.currentPlayer !== playerId)
    return { ok: false, message: "The bot cannot act outside its private Orders handoff." };
  const objective = chooseHiddenObjective(game, playerId, profile);
  const memory = updateBotMemory(game, playerId, profile);
  const diplomacy = reviewDiplomacy(game, playerId, profile, memory);
  if (memory.strategy) diplomacy.push(...executeFactionEconomy(game, playerId, profile, memory.strategy));
  diplomacy.push(...balanceGateViaMarket(game, playerId, profile));
  diplomacy.push(...initiateDiplomacy(game, playerId, profile, memory));
  const recipients = new Set(game.proposals.filter((proposal) => proposal.status === "pending" &&
    (proposal.kind === "technology" ? proposal.seller === playerId : proposal.from === playerId))
    .map((proposal) => proposal.kind === "technology" ? proposal.buyer : proposal.to));
  for (const recipient of recipients) {
    if (game.players[recipient].controller.kind !== "bot") continue;
    const response = reviewBotDiplomacy(game, recipient);
    diplomacy.push(...response.messages.map((message) => `${game.players[recipient].name}: ${message}`));
  }
  diplomacy.push(...reviewDiplomacy(game, playerId, profile, memory));
  // Accepted trades and faction actions can change both affordability and goal progress.
  memory.strategy = createStrategicPlan(projectPrivateGame(game, playerId), playerId, profile, memory.projects);
  memory.projects = memory.strategy.projectPlan.commitments;
  const plan = planBotTurn(game, playerId, profile, objective, memory);
  if (factionRules(player) === "salvo") for (const move of plan.orders) {
    if (move.kind !== "carrierMove") continue;
    for (const carrierId of move.carrierIds) {
      const carrier = game.carriers.find((unit) => unit.id === carrierId && unit.owner === playerId);
      if (!carrier || !carrierLibrary[carrier.type].bombard || plan.orders.some((order) => order.kind === "bombard" && order.carrierId === carrierId)) continue;
      if (plan.orders.length >= profile.planning.maxOrders) break;
      const targets = legalBombardmentTargets(game, playerId, carrierId, undefined, move.destination)
        .filter((target) => target.targetPlayerId !== undefined)
        .sort((a, b) => {
          const garrison = (target: typeof a) => game.hexes.find((hex) => hex.id === target.hexId && hex.owner === target.targetPlayerId)?.combat || 0;
          return garrison(b) - garrison(a) || a.range - b.range || a.hexId.localeCompare(b.hexId);
        });
      const target = targets[0];
      if (!target) continue;
      const shot: SecretOrder = { id: `bot-move-bombard-${carrierId}-${target.hexId}`, kind: "bombard", carrierId, targetHexId: target.hexId, targetPlayerId: target.targetPlayerId, strength: 1 };
      if (projectedOrderBudget(game, playerId, [...plan.orders, shot]).error) continue;
      plan.orders.push(shot);
      plan.report.selectedOrders.push({ label: orderLabel(shot), score: 0, reasons: ["Fires after movement at a hostile force in range of the destination"] });
    }
  }
  if (game.policyElection?.era === game.era && !game.policyElection.votingClosed && (game.turn - 1) % 4 === 0) {
    const deficits = (["material", "currency", "research", "influence"] as Resource[]).sort((a, b) =>
      (memory.strategy?.projectedDeficits[b] || 0) - (memory.strategy?.projectedDeficits[a] || 0));
    const preferences = deficits.map((resource) => ({
      material: ["infrastructure-grants", "arms-expansion", "scientific-exchange", "horizon-priority"],
      currency: ["infrastructure-grants", "civilian-investment", "strategic-mobilization", "open-commerce"],
      research: ["open-markets", "civilian-investment", "scientific-exchange", "horizon-priority"],
      influence: ["cultural-funding", "civilian-investment", "isolationist-sentiment", "open-commerce"],
    })[resource][game.era - 1]);
    const policyId = preferences.find((id) => game.policyElection!.choices.includes(id)) || game.policyElection.choices[0];
    const vote: SecretOrder = { id: `bot-policy-${game.era}-${playerId}`, kind: "policyVote", policyId, influence: 1 };
    const projectedVote = projectedOrderBudget(game, playerId, [...plan.orders, vote]);
    if (!projectedVote.error) plan.orders.push(vote);
  }
  const plannedSubmission = submitSecretOrders(game, playerId, plan.orders);
  const submission = plannedSubmission.ok ? plannedSubmission : submitSecretOrders(game, playerId, []);
  plan.report.diplomacy = diplomacy;
  plan.report.submissionOk = plannedSubmission.ok;
  plan.report.submissionMessage = plannedSubmission.ok ? submission.message : `${plannedSubmission.message} Recovery: ${submission.message}`;
  game.botReports.unshift(plan.report);
  game.botReports = game.botReports.slice(0, 48);
  game.log.unshift(`${player.name}'s ${profile.name} controller sealed ${plan.orders.length || 1} private Order${plan.orders.length === 1 ? "" : "s"}.`);
  return { ...submission, report: plan.report, orders: plannedSubmission.ok ? plan.orders : [] };
}

export function resolveBotCaptureDecision(game: GameState, profile: BotProfile) {
  const pending = game.pendingCenterLoss;
  if (!pending) return false;
  const player = game.players[pending.playerId], habitat = game.hexes.find((hex) => hex.id === pending.hexId);
  if (player.controller.kind !== "bot" || player.controller.profileId !== profile.id || !habitat) return false;
  const value = (center: CenterType) => {
    let score = center === "defense" ? 18 * profile.priorities.survival : center === "labor" ? 17 : 10;
    if (factionRules(player) === "helix" && center === "research") score += 12;
    if (factionRules(player) === "foundry" && center === "material") score += 12;
    if (factionRules(player) === "aurelians" && center === "influence") score += 12;
    if (factionRules(player) === "meridian" && center === "currency") score += 12;
    return score;
  };
  while (game.pendingCenterLoss) {
    const index = habitat.centers.map((center, position) => ({ position, score: value(center) })).sort((a, b) => a.score - b.score || a.position - b.position)[0]?.position;
    if (index === undefined || !removeCapturedCenter(game, pending.playerId, index).ok) break;
  }
  game.log.unshift(`${player.name}'s ${profile.name} controller removed the least valuable excess Center after capture.`);
  return true;
}
