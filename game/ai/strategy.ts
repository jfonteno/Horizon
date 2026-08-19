import { factionLibrary } from "../factions";
import type { GameState, PlayerState, Resource, SecretOrder } from "../types";
import { tributeCosts } from "../rules/economy";
import type { BotOpponentModel, BotProfile, BotStrategicPlan } from "./types";

const resources: Resource[] = ["material", "currency", "research", "influence"];

function productionPerTurn(game: GameState, playerId: number) {
  const player = game.players[playerId], multiplier = player.tech.Resource === 4 ? 2 : 1;
  const production: Record<Resource, number> = { material: 0, currency: 0, research: 0, influence: 0 };
  production[factionLibrary[player.faction].homeProduction]++;
  for (const hex of game.hexes.filter((candidate) => candidate.owner === playerId)) {
    if (["material", "currency", "research", "influence"].includes(hex.kind))
      production[hex.kind as Resource] += multiplier;
    for (const center of hex.centers)
      if (["material", "currency", "research", "influence"].includes(center))
        production[center as Resource] += multiplier;
  }
  return production;
}

function futureContributionCosts(game: GameState, player: PlayerState, count: number) {
  const costs: Record<Resource, number>[] = [];
  for (let era = game.era; era <= 3 && costs.length < count; era++) {
    if (era === game.era && player.eraTributes[era - 1]) continue;
    costs.push({ material: tributeCosts[era].material || 0, currency: tributeCosts[era].currency || 0,
      research: tributeCosts[era].research || 0, influence: tributeCosts[era].influence || 0 });
  }
  while (costs.length < count) costs.push({
    material: tributeCosts[4].material || 0,
    currency: tributeCosts[4].currency || 0,
    research: tributeCosts[4].research || 0,
    influence: tributeCosts[4].influence || 0,
  });
  return costs;
}

function projectedContributionCapacity(game: GameState, player: PlayerState) {
  const turns = Math.max(0, 16 - game.turn), production = productionPerTurn(game, player.id);
  const stock = Object.fromEntries(resources.map((resource) => [resource, player.resources[resource] + production[resource] * turns])) as Record<Resource, number>;
  const maximum = Math.min(6, Math.max(0, game.players.length * 3 - game.gate));
  const costs = futureContributionCosts(game, player, maximum);
  let affordable = 0;
  for (const cost of costs) {
    if (!resources.every((resource) => stock[resource] >= cost[resource])) break;
    resources.forEach((resource) => stock[resource] -= cost[resource]);
    affordable++;
  }
  return affordable;
}

function doctrine(player: PlayerState) {
  if (player.faction === "varkesh") return "Concentrate force, deter opportunistic attacks, and capture only when the LP and production swing exceeds retaliation risk.";
  if (player.faction === "helix") return "Sequence Economy and Resource infrastructure around efficient research, then export knowledge without sacrificing Gate reserves.";
  if (player.faction === "foundry") return "Build a diversified industrial base early, convert Material advantages into Habitats, and route surplus into the Gate coalition.";
  if (player.faction === "aurelians") return "Convert Political Capital into missing Gate inputs, establish Trade Agreements early, and coordinate Labor-backed resource routes.";
  if (player.faction === "meridian") return "Create liquidity through trade and Market access, broker complementary specialists, and prevent resource bottlenecks.";
  return "Reveal deliberately, settle production gaps quickly, and monetize information while preserving the coalition's resource diversity.";
}

export function classifyOpponent(model: Omit<BotOpponentModel, "archetypes">, averageMilitary: number, averageHabitats: number, era: number, leaderLP: number) {
  const archetypes: BotOpponentModel["archetypes"] = [];
  if (model.lp === leaderLP && model.lpTrend > 0) archetypes.push("runaway");
  if (model.military > averageMilitary * 1.3 || model.aggression >= 2) archetypes.push("militarist");
  if (model.habitats > averageHabitats * 1.25) archetypes.push("expansionist");
  if (model.tradeReliability >= .72) archetypes.push("broker");
  if (model.tributes >= Math.min(3, era)) archetypes.push("gate-steward");
  if (era > 1 && model.tributes + 1 < era) archetypes.push("free-rider");
  return archetypes.length ? archetypes : ["balanced" as const];
}

export function createStrategicPlan(game: GameState, playerId: number, profile: BotProfile): BotStrategicPlan {
  const player = game.players[playerId], target = game.players.length * 3, remaining = Math.max(0, target - game.gate);
  const fairShare = Math.max(0, 3 - player.tributes);
  const personalContributionTarget = Math.min(remaining, Math.max(fairShare, Math.ceil(remaining / game.players.length)));
  const costs = futureContributionCosts(game, player, Math.max(1, personalContributionTarget));
  const reserve = costs[0] || { material: 0, currency: 0, research: 0, influence: 0 };
  const followupReserve = costs[1] || { material: 0, currency: 0, research: 0, influence: 0 };
  const contributionDueTurn = game.era < 4 && !player.eraTributes[game.era - 1] ? game.era * 4 : Math.min(16, (game.era + 1) * 4);
  const horizonTurns = Math.min(profile.planning.forecastHorizon, Math.max(0, 16 - game.turn));
  const production = productionPerTurn(game, playerId);
  const projectedDeficits: BotStrategicPlan["projectedDeficits"] = {};
  for (const resource of resources) {
    const projected = player.resources[resource] + production[resource] * Math.max(0, contributionDueTurn - game.turn);
    if (projected < reserve[resource]) projectedDeficits[resource] = reserve[resource] - projected;
  }
  const priorityResources = resources.slice().sort((a, b) =>
    (projectedDeficits[b] || 0) - (projectedDeficits[a] || 0) || reserve[b] - reserve[a]);
  const collectiveProjectedTributes = Math.min(target, game.gate + game.players.reduce((sum, candidate) => sum + projectedContributionCapacity(game, candidate), 0));
  const gateConfidence = target ? Math.min(1, collectiveProjectedTributes / target) : 1;
  const leaders = [...game.players].sort((a, b) => b.lp - a.lp || b.tributes - a.tributes);
  const leaderId = leaders[0]?.id;
  const victoryPressure = Math.max(0, (leaders[0]?.lp || 0) - player.lp) + Math.max(0, game.turn - 12) * .5;
  return {
    generatedTurn: game.turn,
    horizonTurns,
    doctrine: doctrine(player),
    gateEmergency: gateConfidence < profile.planning.minimumGateConfidence || remaining > Math.max(0, 16 - game.turn) * game.players.length / 2,
    gateConfidence,
    collectiveProjectedTributes,
    personalContributionTarget,
    contributionDueTurn,
    reserve,
    followupReserve,
    projectedDeficits,
    priorityResources,
    leaderId,
    victoryPressure,
  };
}

export function strategicOrderModifier(game: GameState, playerId: number, order: SecretOrder, plan: BotStrategicPlan) {
  const player = game.players[playerId], turnsUntilDue = plan.contributionDueTurn - game.turn;
  let score = 0;
  const reasons: string[] = [];
  if (order.kind === "tribute") {
    score += 55 + (plan.gateEmergency ? 130 : 0) + (turnsUntilDue <= 1 ? 100 : 0);
    reasons.push(`Multi-Turn Gate schedule sets the next contribution deadline at Turn ${plan.contributionDueTurn}`);
  }
  if (order.kind === "establish") {
    score += 24 + plan.horizonTurns * 4;
    reasons.push("Four-Turn production forecast values early recurring output");
  }
  if (order.kind === "technology") {
    const preferred = player.faction === "varkesh" ? ["Military"] :
      player.faction === "helix" ? ["Economy", "Resource"] :
      player.faction === "foundry" ? ["Resource", "Exploration"] :
      player.faction === "aurelians" ? ["Economy", "Exploration"] :
      player.faction === "meridian" ? ["Economy", "Policy"] : ["Exploration", "Policy", "Resource"];
    if (preferred.includes(order.branch)) { score += 22; reasons.push("Faction doctrine identifies this as a compounding Technology branch"); }
    if (plan.gateEmergency && !["Economy", "Resource"].includes(order.branch)) score -= 28;
  }
  if (order.kind === "construct" && order.construction.type === "center" && plan.priorityResources.includes(order.construction.center as Resource)) {
    const rank = plan.priorityResources.indexOf(order.construction.center as Resource);
    score += Math.max(0, 28 - rank * 7);
    reasons.push("Center output addresses the ranked multi-Era resource forecast");
  }
  if (order.kind === "construct" && plan.gateEmergency && ["carrier", "recruit"].includes(order.construction.type)) score -= 32;
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
  return { score, reasons };
}
