import { factionRules } from "../factions";
import type { GameState, PlayerState, Resource, SecretOrder } from "../types";
import { tributeCosts } from "../rules/economy";
import type { BotOpponentModel, BotProfile, BotStrategicPlan } from "./types";
import { finalEra, gateTarget, totalTurns } from "../rules/format";
import { createObjectivePlan, measurableObjectiveBonus, objectiveActionBonus, orderObjectiveTags } from "./objectives";
import { activeAgreements, hasBenefit } from "../rules/diplomacy";
import { shortestPath } from "../engine/geometry";
import { mapLibrary } from "../maps";
import { productionForecast } from "../rules/production-forecast";
import type { BotPriority, BotPriorityKey } from "./types";
import { createProjectPlan, projectOrderBonus } from "./projects";
import type { BotProjectMemory } from "./projects";

const resources: Resource[] = ["material", "currency", "research", "influence"];

// A public faction identity is a forecast, not knowledge of future Orders.
// Only visible assets and public faction rules enter this prior.
export function factionOutlook(faction: string) {
  const outlook: Record<string, { resource: Resource; technology: string; military: number }> = {
    varkesh: { resource: "material", technology: "Military", military: 2 },
    helix: { resource: "research", technology: "Economy", military: 0 },
    foundry: { resource: "material", technology: "Resource", military: 0 },
    aurelians: { resource: "influence", technology: "Policy", military: 0 },
    meridian: { resource: "currency", technology: "Economy", military: 0 },
    farbound: { resource: "research", technology: "Exploration", military: 0 },
    spires: { resource: "material", technology: "Resource", military: 0 },
    aegis: { resource: "material", technology: "Military", military: 1 },
    wayfarers: { resource: "currency", technology: "Resource", military: 0 },
    salvo: { resource: "material", technology: "Military", military: 1 },
    guilds: { resource: "currency", technology: "Economy", military: 0 },
  };
  return outlook[faction] || { resource: "material" as Resource, technology: "Economy", military: 0 };
}

function factionPriorities(game: GameState, playerId: number, profile: BotProfile, objectivePlan: BotStrategicPlan["objectivePlan"], production: Record<Resource, number>) {
  const player = game.players[playerId], faction = factionRules(player);
  const base: Record<string, Partial<Record<BotPriorityKey, number>>> = {
    varkesh: { militaryTechnology: 24, recruit: 12, expand: 18, economicCenters: 12 },
    helix: { economicCenters: 22, resourceTechnology: 20, trade: 22, expand: 24 },
    foundry: { economicCenters: 30, expand: 24, resourceTechnology: 18, trade: 12 },
    aurelians: { agreement: 34, policyTechnology: 28, influence: 28, trade: 20, economicCenters: 14 },
    meridian: { trade: 30, agreement: 20, economicCenters: 20, expand: 14 },
    farbound: { explore: 28, expand: 24, economicCenters: 15, trade: 14 },
    spires: { economicCenters: 34, upgrade: 28, resourceTechnology: 26, expand: 16 },
    aegis: { militaryTechnology: 12, economicCenters: 28, agreement: 12, recruit: 8, trade: 18 },
    wayfarers: { mobileCenters: 38, expand: 20, explore: 12, resourceTechnology: 18 },
    salvo: { militaryTechnology: 28, recruit: 15, economicCenters: 16 },
    guilds: { economicCenters: 33, resourceTechnology: 16, expand: 14 },
  };
  const weights = { ...(base[faction] || {}) };
  const reasons: Partial<Record<BotPriorityKey, string>> = {};
  const boost = (key: BotPriorityKey, amount: number, reason: string) => {
    weights[key] = Math.min(60, (weights[key] || 0) + amount);
    reasons[key] = reason;
  };
  const owned = game.hexes.filter((hex) => hex.owner === playerId && hex.tier);
  const active = activeAgreements(game, playerId);
  if (faction === "aurelians") {
    if (!active.length) boost("agreement", 14, "Open the first diplomatic route for Aurelian scoring");
    if (player.tech.Policy < 2) boost("policyTechnology", 14, "Unlock the next tier of Aurelian agreements");
    if (production.influence < 2) boost("influence", 16, "Influence income cannot yet sustain diplomacy");
    if (active.length >= 2) weights.agreement = Math.max(6, (weights.agreement || 0) - 20);
  }
  if (faction === "spires") {
    if (player.tech.Resource < 4) {
      if (production.research < 2) boost("economicCenters", 22, "Stage 1: secure recurring Research for Resource IV");
      if (production.material < 2) boost("economicCenters", 18, "Stage 1: secure recurring Material for Resource IV");
      boost("resourceTechnology", 34, "Stage 2: advance Resource toward IV when its inputs are funded");
      if (player.tech.Resource >= 2 && owned.filter((hex) => hex.tier !== "Outpost").length < 2)
        boost("upgrade", 24, "Stage 3: grow two cities while Resource technology advances");
    } else {
      boost("upgrade", 30, "Stage 4: upgrade Metropolises into Arcologies");
      boost("economicCenters", 14, "Fill the new Arcology capacity with economic Centers");
    }
  }
  if (faction === "aegis" && player.tech.Economy < 2) {
    boost("economicCenters", 14, "Build independent Currency production before selling Blockades");
    boost("trade", 12, "Economy II opens commissioned Blockade sales without Military technology");
  }
  if (faction === "foundry" && production.currency === 0) {
    boost("trade", 26, "Exchange surplus Material for Currency before construction stalls");
    if (!active.some((agreement) => agreement.type === "trade"))
      boost("agreement", 28, "Open a reliable Currency route, preferably with a Currency specialist");
    if (!game.players.some((candidate) => candidate.id !== playerId && factionOutlook(factionRules(candidate)).resource === "currency"))
      boost("explore", 18, "Find Currency worlds and contact another partner when no specialist is present");
  }
  if (faction === "wayfarers") {
    const mobiles = game.mobileHabitats.filter((mobile) => mobile.owner === playerId);
    if (player.tech.Resource < 2) boost("resourceTechnology", 22, "Stage 1: unlock construction of a second Arkship");
    if (production.material < 2 || production.currency < 2)
      boost("mobileCenters", 22, "Stage 1: establish Material and Currency production aboard the caravan");
    else if (mobiles.length < 2) boost("expand", 28, "Stage 2: add a second mobile Habitat");
    else if (player.tech.Exploration < 2) boost("explore", 24, "Stage 3: unlock Deep Recon after the production fleet expands");
  }
  if (production.material === 0 || production.currency === 0)
    boost(faction === "wayfarers" ? "mobileCenters" : "economicCenters", 14, "Secure independent Gate and construction resources");
  if (owned.length < 2 && player.colonyShips.length && game.turn < totalTurns(game) - 4)
    boost("expand", 14, "A second Habitat compounds production across remaining Turns");
  if (objectivePlan.actionWeights.agreement && objectivePlan.actionWeights.agreement > 25)
    boost("agreement", 12, "Current Legacy objectives reward diplomatic agreements");
  if (objectivePlan.actionWeights.center && objectivePlan.actionWeights.center > 25)
    boost(faction === "wayfarers" ? "mobileCenters" : "economicCenters", 10, "Current Legacy objectives reward construction");
  const defenseNeeds: Record<string, number> = {};
  if (profile.difficulty === "hard" || profile.difficulty === "emperor") {
    const map = mapLibrary[game.mapId];
    const stationedAcrossEmpire = owned.reduce((sum, hex) => sum + hex.combat, 0);
    for (const hex of owned) {
      const stationed = hex.combat + game.carriers.filter((carrier) => carrier.owner === playerId && carrier.hex === hex.id)
        .reduce((sum, carrier) => sum + carrier.cu, 0);
      const opponents = game.players.filter((rival) => rival.id !== playerId && !hasBenefit(game, playerId, rival.id, "nonAggression"));
      const risk = opponents.reduce((maximum, rival) => {
        const outlook = factionOutlook(factionRules(rival));
        const visibleFleet = game.carriers.filter((carrier) => carrier.owner === rival.id && carrier.cu > 0)
          .some((carrier) => carrier.hex === hex.id || (shortestPath(carrier.hex, hex.id, map).length || 99) <= 4);
        const neighboringBase = game.hexes.filter((target) => target.owner === rival.id && target.tier)
          .some((target) => target.id === hex.id || (shortestPath(target.id, hex.id, map).length || 99) <= 5);
        const canFundProactiveDefense = production.currency > 0 || player.resources.currency >= 3;
        return Math.max(maximum, visibleFleet ? 3 : game.turn >= 3 && neighboringBase &&
          stationedAcrossEmpire < 2 && canFundProactiveDefense ? outlook.military : 0);
      }, 0);
      if (risk > 0 && stationed < Math.min(3, risk + 1)) defenseNeeds[hex.id] = Math.min(3, risk + 1) - stationed;
    }
    if (Object.keys(defenseNeeds).length) boost("recruit", 22, "Visible military pressure or a nearby militarist opening warrants a garrison");
  }
  const priorities: BotPriority[] = Object.entries(weights).filter((entry): entry is [BotPriorityKey, number] => Boolean(entry[1]))
    .map(([key, weight]) => ({ key, weight, reason: reasons[key] || `${faction} faction development` }))
    .sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key));
  return { priorities, defenseNeeds };
}

export function productionPerTurn(game: GameState, playerId: number) {
  const { totals } = productionForecast(game, playerId);
  return { material: totals.material, currency: totals.currency, research: totals.research, influence: totals.influence };
}

/** A flexible Homeworld can temporarily make Currency, but cannot make it and
 * its faction's primary resource at the same time. This is the bootstrap goal. */
export function needsCurrencyCenter(game: GameState, playerId: number) {
  const faction = factionRules(game.players[playerId]);
  if (faction === "wayfarers" || faction === "aurelians") return false;
  const flexibleHome = ["varkesh", "helix", "farbound"].includes(faction);
  return !productionForecast(game, playerId).sources.some((source) =>
    source.resource === "currency" && (source.label !== "Homeworld" || !flexibleHome));
}

function futureContributionCosts(game: GameState, player: PlayerState, count: number) {
  const costs: Record<Resource, number>[] = [];
  for (let era = game.era; era < finalEra(game) && costs.length < count; era++) {
    if (era === game.era && player.eraTributes[era - 1]) continue;
    costs.push({ material: tributeCosts[era].material || 0, currency: tributeCosts[era].currency || 0,
      research: tributeCosts[era].research || 0, influence: tributeCosts[era].influence || 0 });
  }
  while (costs.length < count) costs.push({
    material: tributeCosts[finalEra(game)].material || 0,
    currency: tributeCosts[finalEra(game)].currency || 0,
    research: tributeCosts[finalEra(game)].research || 0,
    influence: tributeCosts[finalEra(game)].influence || 0,
  });
  return costs;
}

function projectedContributionCapacity(game: GameState, player: PlayerState) {
  // Future production is a forecast, not a stockpile available this Turn. Allow
  // a portion for construction and other Orders, and respect the per-Era limit.
  const production = productionPerTurn(game, player.id);
  const stock = { ...player.resources };
  let affordable = 0, contributedThisEra = player.eraTributes[game.era - 1] > 0;
  for (let turn = game.turn; turn <= totalTurns(game); turn++) {
    if (turn > game.turn) {
      for (const resource of resources) stock[resource] += production[resource] * .75;
      if (Math.ceil(turn / 4) !== Math.ceil((turn - 1) / 4)) contributedThisEra = false;
    }
    const era = Math.ceil(turn / 4), cost = tributeCosts[era];
    let labor = turn === game.turn ? player.labor : player.laborCap;
    while ((era === finalEra(game) || !contributedThisEra) && labor >= (cost.labor || 0) &&
      resources.every((resource) => stock[resource] >= (cost[resource] || 0)) &&
      affordable < gateTarget(game) - game.gate) {
      for (const resource of resources) stock[resource] -= cost[resource] || 0;
      labor -= cost.labor || 0;
      affordable++;
      contributedThisEra = true;
      if (era !== finalEra(game) || !cost.labor) break;
    }
  }
  return affordable;
}

function doctrine(player: PlayerState) {
  if (factionRules(player) === "varkesh") return "Concentrate force, deter opportunistic attacks, and capture only when the LP and production swing exceeds retaliation risk.";
  if (factionRules(player) === "helix") return "Sequence Economy and Resource infrastructure around efficient research, then export knowledge without sacrificing Gate reserves.";
  if (factionRules(player) === "foundry") return "Secure Currency through a specialist trade partner or early contact, then build independent Currency production before industrial growth stalls.";
  if (factionRules(player) === "aurelians") return "Convert Political Capital into missing Gate inputs, establish Trade Agreements early, and coordinate Labor-backed resource routes.";
  if (factionRules(player) === "meridian") return "Create liquidity through trade and Market access, broker complementary specialists, and prevent resource bottlenecks.";
  if (factionRules(player) === "farbound") return "Survey privately, move Explorers alongside Forward Scans, and trade useful discoveries without stalling expansion.";
  if (factionRules(player) === "spires") return "Concentrate Centers and Defense Grids in a few Habitats, then advance Resource technology toward Arcologies.";
  if (factionRules(player) === "aegis") return "Build a discounted first economic Center, advance Economy to II, and commission Blockades for reachable buyers; Military II remains the route for your own movable defenses.";
  if (factionRules(player) === "wayfarers") return "Migrate mobile Habitats toward productive worlds and build mobile Centers to diversify the caravan economy.";
  if (factionRules(player) === "salvo") return "Use Bombardment to soften hostile positions while keeping artillery supplied and the Gate funded.";
  if (factionRules(player) === "guilds") return "Advance Economy technology, enhance productive Centers, and direct Factory output toward the tightest resource constraint.";
  return "Develop production, explore deliberately, and preserve the Gate reserve.";
}

export function classifyOpponent(model: Pick<BotOpponentModel, "lp" | "lpTrend" | "military" | "aggression" | "habitats" | "tradeReliability" | "tributes">, averageMilitary: number, averageHabitats: number, era: number, leaderLP: number) {
  const archetypes: BotOpponentModel["archetypes"] = [];
  if (model.lp === leaderLP && model.lpTrend > 0) archetypes.push("runaway");
  if (model.military > averageMilitary * 1.3 || model.aggression >= 2) archetypes.push("militarist");
  if (model.habitats > averageHabitats * 1.25) archetypes.push("expansionist");
  if (model.tradeReliability >= .72) archetypes.push("broker");
  if (model.tributes >= Math.min(3, era)) archetypes.push("gate-steward");
  if (era > 1 && model.tributes + 1 < era) archetypes.push("free-rider");
  return archetypes.length ? archetypes : ["balanced" as const];
}

export function createStrategicPlan(game: GameState, playerId: number, profile: BotProfile, previousProjects: BotProjectMemory[] = []): BotStrategicPlan {
  const player = game.players[playerId], target = gateTarget(game), remaining = Math.max(0, target - game.gate);
  const fairShare = Math.max(0, finalEra(game) - 1 - player.tributes);
  const personalContributionTarget = Math.min(remaining, Math.max(fairShare, Math.ceil(remaining / game.players.length)));
  const costs = remaining > 0 ? futureContributionCosts(game, player, Math.max(1, personalContributionTarget)) : [];
  const reserve = costs[0] || { material: 0, currency: 0, research: 0, influence: 0 };
  const followupReserve = costs[1] || { material: 0, currency: 0, research: 0, influence: 0 };
  const contributionDueTurn = game.era < finalEra(game) && !player.eraTributes[game.era - 1] ? game.era * 4 : Math.min(totalTurns(game), (game.era + 1) * 4);
  const horizonTurns = Math.min(profile.planning.forecastHorizon, Math.max(0, totalTurns(game) - game.turn));
  const production = productionPerTurn(game, playerId);
  const projectedDeficits: BotStrategicPlan["projectedDeficits"] = {};
  const totalDemand = Object.fromEntries(resources.map((resource) =>
    [resource, costs.reduce((sum, cost) => sum + cost[resource], 0)])) as Record<Resource, number>;
  for (const resource of resources) {
    const dueStock = player.resources[resource] + production[resource] * .75 * Math.max(0, contributionDueTurn - game.turn);
    const finalStock = player.resources[resource] + production[resource] * .75 * Math.max(0, totalTurns(game) - game.turn);
    const deficit = Math.max(0, reserve[resource] - dueStock, totalDemand[resource] - finalStock);
    if (deficit > 0) projectedDeficits[resource] = Math.ceil(deficit);
  }
  const priorityResources = resources.slice().sort((a, b) =>
    (projectedDeficits[b] || 0) - (projectedDeficits[a] || 0) || totalDemand[b] - totalDemand[a]);
  const collectiveProjectedTributes = Math.min(target, game.gate + game.players.reduce((sum, candidate) => sum + projectedContributionCapacity(game, candidate), 0));
  const gateConfidence = target ? Math.min(1, collectiveProjectedTributes / target) : 1;
  const leaders = [...game.players].sort((a, b) => b.lp - a.lp || b.tributes - a.tributes);
  const leaderId = leaders[0]?.id;
  const victoryPressure = Math.max(0, (leaders[0]?.lp || 0) - player.lp) + Math.max(0, game.turn - 12) * .5;
  const objectivePlan = createObjectivePlan(game, playerId, profile);
  const projectPlan = createProjectPlan(game, playerId, profile, previousProjects);
  const { priorities, defenseNeeds } = factionPriorities(game, playerId, profile, objectivePlan, production);
  return {
    generatedTurn: game.turn,
    difficulty: profile.difficulty,
    horizonTurns,
    doctrine: doctrine(player),
    gateEmergency: gateConfidence < profile.planning.minimumGateConfidence ||
      (game.era < finalEra(game) && !player.eraTributes[game.era - 1] &&
        contributionDueTurn - game.turn <= 1 && !resources.every((resource) => player.resources[resource] >= reserve[resource])) ||
      remaining > Math.max(0, totalTurns(game) - game.turn) * game.players.length / 2,
    gateConfidence,
    collectiveProjectedTributes,
    personalContributionTarget,
    contributionDueTurn,
    reserve,
    followupReserve,
    gateDemand: totalDemand,
    projectedDeficits,
    priorityResources,
    leaderId,
    victoryPressure,
    objectivePlan,
    projectPlan,
    priorities,
    defenseNeeds,
  };
}

export function strategicOrderModifier(game: GameState, playerId: number, order: SecretOrder, plan: BotStrategicPlan) {
  const player = game.players[playerId], turnsUntilDue = plan.contributionDueTurn - game.turn;
  let score = 0;
  const reasons: string[] = [];
  let objectiveTags = orderObjectiveTags(order);
  if (order.kind === "civilianMove") {
    const unit = game.civilianUnits.find((candidate) => candidate.id === order.unitId && candidate.owner === playerId);
    objectiveTags = unit?.type === "envoy" ? ["agreement"] : unit?.type === "prospector" ? ["prospect", "material"] : ["survey", "explore"];
  }
  if (order.kind === "explorerMove" && game.hexes.some((hex) => hex.id === order.destination && hex.revealed))
    objectiveTags = [];
  if (order.kind === "carrierMove" && !game.hexes.some((hex) => hex.id === order.destination &&
      hex.owner !== undefined && hex.owner !== playerId) &&
      !game.carriers.some((carrier) => carrier.hex === order.destination && carrier.owner !== playerId))
    objectiveTags = [];
  const measurable = measurableObjectiveBonus(game, playerId, order, plan.objectivePlan);
  const objectiveBonus = order.kind === "carrierMove" && !game.hexes.some((hex) => hex.id === order.destination &&
    hex.owner !== undefined && hex.owner !== playerId) ? Math.min(25, objectiveActionBonus(plan.objectivePlan, objectiveTags)) :
    objectiveActionBonus(plan.objectivePlan, objectiveTags);
  score += measurable.score + objectiveBonus;
  if (plan.difficulty === "medium" || plan.difficulty === "hard" || plan.difficulty === "emperor") {
    const project = projectOrderBonus(game, playerId, order, plan.projectPlan.projects);
    score += project.score;
    reasons.push(...project.reasons);
  }
  if (measurable.advanced.length) {
    reasons.push(`Measurably advances ${measurable.advanced.slice(0, 3).join(", ")}`);
  } else if (objectiveBonus > 0) {
    reasons.push("Supports a longer-term Legacy objective");
  }
  const hidden = plan.objectivePlan.goals.find((goal) => goal.category === "hidden");
  if (hidden && hidden.completion < 1) {
    const hiddenMatches = hidden.tags.filter((tag) => objectiveTags.includes(tag)).length;
    if (hiddenMatches && (measurable.score > 0 || order.kind !== "carrierMove")) {
      score += hiddenMatches * 12;
      reasons.push(`Directly advances Hidden objective ${hidden.objectiveId}`);
    }
    const construction = order.kind === "construct" ? order.construction.type : undefined;
    const direct =
      (hidden.objectiveId === "h2-colonial" && (order.kind === "establish" || order.kind === "colonyMove" || construction === "module" || construction === "upgrade")) ||
      (["h1-specialist", "h2-balanced", "h3-tech", "h4-science", "h4-complete", "h5-science"].includes(hidden.objectiveId) && order.kind === "technology") ||
      (["h1-renaissance", "h1-peace", "h2-builder", "h3-builder", "h3-architect", "h5-great"].includes(hidden.objectiveId) && order.kind === "construct" && ["center", "upgrade", "module"].includes(construction || "")) ||
      (["h1-mobilization", "h2-arms", "h2-guardian", "h3-mobilization", "h3-peace", "h4-arsenal"].includes(hidden.objectiveId) && order.kind === "construct" && ["recruit", "carrier"].includes(construction || "")) ||
      (["h1-surveyor", "h1-frontier"].includes(hidden.objectiveId) &&
        (order.kind === "explorerMove" && game.hexes.some((hex) => hex.id === order.destination && !hex.revealed) ||
          ["explorerScan", "longRangeSurvey"].includes(order.kind))) ||
      (["h4-expansion", "h5-expansion"].includes(hidden.objectiveId) && ["establish", "colonyMove", "carrierMove"].includes(order.kind));
    if (direct) {
      const turnsLeft = Math.max(1, hidden.deadlineTurn - game.turn + 1);
      const urgency = Math.max(0, 5 - turnsLeft) * 12 + (hidden.progress === 0 ? 18 : 0);
      const directWeight = ["h3-tech", "h4-science"].includes(hidden.objectiveId) ? 112 :
        ["h2-colonial", "h4-complete", "h4-expansion"].includes(hidden.objectiveId) ? 96 : 78;
      score += directWeight + urgency;
      reasons.push(`Hidden objective ${hidden.objectiveId} receives a direct-action priority`);
    }
  }
  if (hidden && hidden.completion < 1) {
    const metrics = player.legacyMetrics, eraIndex = game.era - 1;
    const construction = order.kind === "construct" ? order.construction : undefined;
    let closesRequirement = false;
    if (["h1-renaissance", "h1-peace", "h1-specialist"].includes(hidden.objectiveId)) {
      closesRequirement = (order.kind === "technology" && metrics.technologyAdvances[eraIndex].length === 0) ||
        (construction?.type === "center" && metrics.builtCenters[eraIndex] === 0);
    }
    if (hidden.objectiveId === "h2-balanced" && order.kind === "technology")
      closesRequirement = player.tech[order.branch] < 2;
    if (["h3-tech", "h4-science"].includes(hidden.objectiveId) && order.kind === "technology") {
      const unfinishedLevels = Object.values(player.tech).filter((level) => level < 4);
      closesRequirement = player.tech[order.branch] === Math.max(...unfinishedLevels);
    }
    if (["h2-builder", "h3-builder", "h3-architect"].includes(hidden.objectiveId) && construction)
      closesRequirement = construction.type === "center" || construction.type === "upgrade";
    if (closesRequirement) {
      score += 100;
      reasons.push("Targets an unfinished requirement rather than repeating an already achieved pillar");
    }
  }
  if (hidden && ["h1-peace", "h2-guardian", "h3-peace"].includes(hidden.objectiveId) && order.kind === "carrierMove") {
      const target = game.hexes.find((hex) => hex.id === order.destination);
      if ((target?.owner !== undefined && target.owner !== playerId) ||
          game.carriers.some((carrier) => carrier.hex === order.destination && carrier.owner !== playerId)) {
        score -= 500;
        reasons.push("Preserves the Hidden objective's no-initiated-combat requirement");
      }
  }
  if (order.kind === "tribute") {
    score += 55 + (plan.gateEmergency ? 130 : 0) + (turnsUntilDue <= 1 ? 100 : 0);
    reasons.push(`Multi-Turn Gate schedule sets the next contribution deadline at Turn ${plan.contributionDueTurn}`);
    if (factionRules(player) === "wayfarers" && game.turn < totalTurns(game) - 2 && !plan.gateEmergency &&
        !game.mobileHabitats.some((mobile) => mobile.owner === playerId && mobile.centers.includes("currency")) &&
        player.resources.currency < 3) {
      score -= 115;
      reasons.push("Currency is needed to establish the first self-sustaining mobile Center");
    }
  }
  if (order.kind === "establish") {
    score += 24 + plan.horizonTurns * 4;
    reasons.push("Four-Turn production forecast values early recurring output");
  }
  if (order.kind === "technology") {
    const preferred = factionRules(player) === "varkesh" ? ["Military"] :
      factionRules(player) === "helix" ? ["Economy", "Resource"] :
      factionRules(player) === "foundry" ? ["Resource", "Exploration"] :
      factionRules(player) === "aurelians" ? ["Policy", "Economy"] :
      factionRules(player) === "meridian" ? ["Economy", "Policy"] :
      factionRules(player) === "spires" ? ["Resource", "Military"] :
      factionRules(player) === "aegis" ? ["Economy", "Military"] :
      factionRules(player) === "wayfarers" ? ["Resource", "Exploration"] :
      factionRules(player) === "salvo" ? ["Military"] :
      factionRules(player) === "guilds" ? ["Economy", "Resource"] : ["Exploration", "Policy", "Resource"];
    if (preferred.includes(order.branch)) { score += 22; reasons.push("Faction doctrine identifies this as a compounding Technology branch"); }
    if (plan.gateEmergency && !["Economy", "Resource"].includes(order.branch)) score -= 28;
  }
  if (order.kind === "construct" && (order.construction.type === "center" || order.construction.type === "mobileCenter") && plan.priorityResources.includes(order.construction.center as Resource)) {
    const rank = plan.priorityResources.indexOf(order.construction.center as Resource);
    score += Math.max(0, 28 - rank * 7);
    reasons.push("Center output addresses the ranked multi-Era resource forecast");
    const resource = order.construction.center as Resource;
    if ((plan.projectedDeficits[resource] || 0) > 0 && productionPerTurn(game, playerId)[resource] === 0 &&
        game.turn <= totalTurns(game) - 3) {
      score += Math.min(105, 45 + (plan.projectedDeficits[resource] || 0) * 18);
      reasons.push(`The Gate forecast has no recurring ${resource} route`);
    }
    if ((plan.difficulty === "hard" || plan.difficulty === "emperor") &&
        (resource === "material" || resource === "currency" || resource === "research") &&
        productionPerTurn(game, playerId)[resource] === 0 &&
        (plan.projectedDeficits[resource] || player.resources[resource] < 3)) {
      score += plan.difficulty === "emperor" ? 64 : 38;
      reasons.push(`Independent ${resource} production reduces reliance on rival trading partners`);
    }
  }
  if (order.kind === "construct" && order.construction.type === "center" && order.construction.center === "influence" &&
      factionRules(player) === "aurelians" && game.turn <= 4 && productionPerTurn(game, playerId).influence < 2) {
    score += 190;
    reasons.push("An early Influence Center funds Political Capital conversions and future agreements every Turn");
  }
  if (order.kind === "construct" && order.construction.type === "center" && order.construction.center === "influence" &&
      game.gate < gateTarget(game) && tributeCosts[finalEra(game)].influence > 0 &&
      productionPerTurn(game, playerId).influence === 0 && game.turn >= 4 && game.turn <= totalTurns(game) - 3 &&
      productionPerTurn(game, playerId).currency > 0) {
    score += plan.difficulty === "emperor" ? 98 : plan.difficulty === "hard" ? 70 : 44;
    reasons.push("The final Gate Tribute requires Influence that the Market cannot supply");
  }
  if (order.kind === "construct" && order.construction.type === "center" && order.construction.center === "currency" &&
      factionRules(player) === "aurelians" && game.turn <= 8 && productionPerTurn(game, playerId).currency === 0 &&
      productionPerTurn(game, playerId).influence >= 2) {
    score += 150;
    reasons.push("Converted Influence funds permanent Currency income for future construction and Gate Tributes");
  }
  if (order.kind === "construct" && plan.gateEmergency && ["carrier", "recruit"].includes(order.construction.type) &&
      !(order.construction.type === "recruit" && plan.defenseNeeds[order.habitatId])) score -= 32;
  if (order.kind === "carrierMove") {
    const target = game.hexes.find((hex) => hex.id === order.destination);
    if (target && target.owner === plan.leaderId && target.owner !== playerId) {
      score += 20 + plan.victoryPressure * 3;
      reasons.push("Victory-impact model favors pressure against the projected leader");
    } else if (target?.owner !== undefined && target.owner !== playerId && game.players[target.owner].lp + 3 < player.lp) {
      score -= 22;
      reasons.push("Avoids kingmaking through low-impact attacks on a trailing civilization");
    }
  }
  const priorityKey: BotPriorityKey | undefined = order.kind === "technology" ?
    order.branch === "Policy" ? "policyTechnology" : order.branch === "Resource" ? "resourceTechnology" :
      order.branch === "Military" ? "militaryTechnology" : undefined :
    order.kind === "construct" ?
      order.construction.type === "center" ? order.construction.center === "influence" && factionRules(player) === "aurelians" ? "influence" : "economicCenters" :
      order.construction.type === "mobileCenter" ? "mobileCenters" :
      order.construction.type === "recruit" ? "recruit" :
      order.construction.type === "upgrade" || order.construction.type === "arcology" ? "upgrade" : undefined :
    order.kind === "establish" ? "expand" :
    order.kind === "explorerMove" || order.kind === "explorerScan" ? "explore" :
    order.kind === "tribute" ? "tribute" : undefined;
  const priority = plan.priorities.find((entry) => entry.key === priorityKey);
  if (priority && priority.key !== "recruit") {
    const amount = priority.weight * (plan.difficulty === "emperor" ? 1 : plan.difficulty === "hard" ? .8 : .45);
    score += amount;
    reasons.push(`${priority.reason} (${priority.key} priority)`);
  }
  if (order.kind === "construct" && order.construction.type === "recruit") {
    const need = plan.defenseNeeds[order.habitatId] || 0;
    if (need > 0) {
      const pairs = order.construction.pairs;
      score += 38 + (priority?.weight || 0) + Math.min(need, pairs * 2) * 10 -
        Math.max(0, pairs * 2 - need) * 14;
      reasons.push(`A visible or likely attack calls for ${need} additional stationed CUs at ${order.habitatId}`);
    }
  }
  return { score, reasons };
}
