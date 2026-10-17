import { factionRules } from "../factions";
import { technologyCost } from "../rules/diplomacy";
import { centerCosts, tributeCosts } from "../rules/economy";
import { gateTarget, totalTurns } from "../rules/format";
import { civilizationObjectives, legacyObjectiveProgress, universalLegacy } from "../rules/legacy";
import { productionForecast } from "../rules/production-forecast";
import type { GameState, Resource, SecretOrder, TechnologyBranch } from "../types";
import type { BotProfile } from "./types";

const resources: Resource[] = ["material", "currency", "research", "influence"];
type ProjectAction = "technology" | "center" | "develop" | "metro" | "arcology" | "habitat" |
  "blockade" | "mobileHabitat" | "enhanceCenter" | "bombard" | "survey" | "agreement" |
  "prospect" | "migration" | "factory" | "recruit";

export type ProjectMilestone = {
  key: string;
  label: string;
  action: ProjectAction;
  current: number;
  target: number;
  branch?: TechnologyBranch;
  resource?: Resource | "defense";
  cost: Partial<Record<Resource | "labor", number>>;
};

export type BotProject = {
  id: string;
  name: string;
  category: "civilization" | "universal";
  lp: number;
  deadline: number;
  milestones: ProjectMilestone[];
  next: ProjectMilestone;
  score: number;
  missing: Partial<Record<Resource, number>>;
  route: Partial<Record<Resource, "income" | "market" | "trade" | "infrastructure" | "unavailable">>;
  budget: { required: Record<Resource, number>; projected: Record<Resource, number>;
    deficit: Record<Resource, number>; labor: number; minimumTurns: number };
};

export type BotProjectMemory = { id: string; committedTurn: number; lastProgress: number };
export type BotProjectPlan = { projects: BotProject[]; commitments: BotProjectMemory[] };

function projectSteps(game: GameState, playerId: number, id: string): ProjectMilestone[] {
  const player = game.players[playerId];
  const owned = game.hexes.filter((hex) => hex.owner === playerId && hex.tier);
  const centerCount = (resource: Resource | "defense") => owned.reduce((sum, hex) => sum + hex.centers.filter((center) => center === resource).length, 0);
  const economic = owned.reduce((sum, hex) => sum + hex.centers.filter((center) => !["defense", "factory"].includes(center)).length, 0);
  const cities = owned.filter((hex) => hex.tier !== "Outpost").length;
  const metros = owned.filter((hex) => hex.tier === "Metropolis" || hex.tier === "Arcology").length;
  const mobiles = game.mobileHabitats.filter((mobile) => mobile.owner === playerId);
  const developed = owned.filter((hex) => hex.tier !== "Outpost");
  const grids = owned.filter((hex) => hex.centers.includes("defense") && hex.defenseGridOrigin === "spires");
  const protectedCount = owned.filter((hex) => hex.centers.includes("defense") || game.blockades.some((blockade) => blockade.owner === playerId && blockade.active && blockade.hex === hex.id)).length;
  const enhanced = owned.reduce((sum, hex) => sum + (hex.enhancedCenterIndices?.length || 0), 0);
  const agreements = new Set(game.agreements.filter((agreement) => agreement.parties.includes(playerId) &&
    (agreement.endsAfterTurn === undefined || agreement.endsAfterTurn >= game.turn))
    .flatMap((agreement) => agreement.parties.filter((id) => id !== playerId))).size;
  const tradePartners = new Set(game.agreements.filter((agreement) => agreement.parties.includes(playerId) &&
    ["trade", "alliance"].includes(agreement.type) &&
    (agreement.endsAfterTurn === undefined || agreement.endsAfterTurn >= game.turn))
    .flatMap((agreement) => agreement.parties.filter((id) => id !== playerId))).size;
  const milestone = (key: string, label: string, action: ProjectAction, current: number, target: number,
    cost: ProjectMilestone["cost"] = {}, branch?: TechnologyBranch, resource?: Resource | "defense"): ProjectMilestone =>
    ({ key, label, action, current, target, cost, branch, resource });
  const tech = (branch: TechnologyBranch, target: number) => milestone(`${branch}-${target}`, `${branch} ${target}`,
    "technology", player.tech[branch], target, player.tech[branch] < 4 ? technologyCost(game, playerId, branch, player.tech[branch] + 1) : {}, branch);
  const center = (resource: Resource | "defense", target: number) => milestone(`center-${resource}-${target}`,
    `${resource} Centers ${centerCount(resource)}/${target}`, "center", centerCount(resource), target,
    resource === "defense" ? { material: 2, currency: 1, labor: 1 } : centerCosts[resource], undefined, resource);
  const habitats = (target: number) => milestone(`habitats-${target}`, `Habitats ${owned.length}/${target}`, "habitat",
    owned.length, target, player.modules > 0 && player.colonyShips.length > 0 ? {} : { material: 3, currency: 2, labor: 2 });
  const develop = (target: number) => milestone(`cities-${target}`, `Colonies ${cities}/${target}`, "develop",
    cities, target, { material: 2, currency: factionRules(player) === "spires" ? 1 : 2, labor: 2 });
  const metro = (target: number) => milestone(`metros-${target}`, `Metropolises ${metros}/${target}`, "metro",
    metros, target, { material: 3, currency: factionRules(player) === "spires" ? 2 : 3, labor: 3 });
  const economicCenters = (target: number) => milestone(`economic-${target}`, `Economic Centers ${economic}/${target}`,
    "center", economic, target, { material: 1, currency: 2, labor: 1 });
  const mobileCount = (target: number) => milestone(`mobile-${target}`, `Mobile Habitats ${mobiles.length}/${target}`,
    "mobileHabitat", mobiles.length, target, { material: 3, currency: 2, labor: 2 });
  const arcology = () => milestone("arcology", "Spires Arcology", "arcology",
    Number(owned.some((hex) => hex.tier === "Arcology" && hex.arcologyOrigin === "spires")), 1,
    { material: 4, currency: 3, labor: 3 });
  const bombard = (target: number) => milestone(`bombard-${target}`, `Bombardment Turns ${new Set(player.legacyMetrics.salvoBombardTurns).size}/${target}`,
    "bombard", new Set(player.legacyMetrics.salvoBombardTurns).size, target);
  const enhancedCount = (target: number) => milestone(`enhanced-${target}`, `Enhanced Centers ${enhanced}/${target}`,
    "enhanceCenter", enhanced, target, { material: 3, currency: 3, research: 2 });

  switch (id) {
    case "sp-urban": return [tech("Resource", 2), develop(2), economicCenters(4)];
    case "sp-fortified": return [tech("Resource", 3), develop(2), arcology(), center("defense", 2)];
    case "sp-arcology": return [center("material", 2), center("research", 2), tech("Resource", 3),
      arcology(), economicCenters(6)];
    case "sp-vertical": return [tech("Resource", 3), milestone("spires-arcs-2", "Arcologies 2", "arcology", owned.filter((hex) => hex.tier === "Arcology" && hex.arcologyOrigin === "spires").length, 2, { material: 4, currency: 3, labor: 3 }), economicCenters(8)];
    case "sp-horizon": return [tech("Resource", 4), milestone("spires-arcs-2", "Arcologies 2", "arcology", owned.filter((hex) => hex.tier === "Arcology" && hex.arcologyOrigin === "spires").length, 2, { material: 4, currency: 3, labor: 3 }), economicCenters(10)];
    case "ae-fortress": return [habitats(3), develop(1), milestone("protect-3", `Protected Habitats ${protectedCount}/3`, "blockade", protectedCount, 3, { material: 2, currency: 1, labor: 1 })];
    case "ae-arms": return [tech("Economy", 2), milestone("sales-2", "Commission Blockades for two civilizations", "agreement", new Set(player.legacyMetrics.aegisPlatformTransfers).size, 2)];
    case "wa-caravan": return [tech("Resource", 2), mobileCount(2)];
    case "wa-voyage": return [milestone("arkship-voyage", "Arkship migrations through 3 hexes", "migration",
      new Set(player.legacyMetrics.wayfarerArkshipHexes || []).size, 3)];
    case "wa-wandering": return [mobileCount(2), milestone("mobile-centers", "Build mobile production and migrate", "migration", new Set(player.legacyMetrics.wayfarerProductionHexes).size, 3)];
    case "wa-advanced": return [mobileCount(2), tech("Exploration", 2), milestone("long-voyage", "Migrate through 6 hexes", "migration", new Set(player.legacyMetrics.wayfarerMigrationHexes).size, 6)];
    case "sa-mission": return [bombard(3)];
    case "sa-superiority": return [bombard(3), milestone("salvo-kills", "Bombardment kills", "bombard", player.legacyMetrics.salvoBombardKills, 6)];
    case "sa-network": return [bombard(6), milestone("salvo-network-kills", "Bombardment kills", "bombard", player.legacyMetrics.salvoBombardKills, 6)];
    case "gu-specialized": return [milestone("center-types", "Three Center types", "center", new Set(owned.flatMap((hex) => hex.centers.filter((c) => !["defense", "labor", "factory"].includes(c)))).size, 3, { material: 1, currency: 2, labor: 1 })];
    case "gu-masterworks": return [economicCenters(2), enhancedCount(2)];
    case "gu-engine": return [enhancedCount(4), milestone("production-10", "Production of 10", "center", Math.max(0, ...player.legacyMetrics.productionTotals), 10, centerCosts.currency)];
    case "h-network": return [tech("Resource", 2), habitats(2), develop(1), center("research", 3)];
    case "h-breadth": return (["Economy", "Resource", "Policy", "Exploration", "Military"] as TechnologyBranch[])
      .sort((a, b) => player.tech[b] - player.tech[a]).slice(0, 3).map((branch) => tech(branch, 3));
    case "f-engine": return [center("material", 2), milestone("four-material", "Four Material in production", "center", Math.max(0, ...player.legacyMetrics.productionAmounts.map((amount) => amount.material)), 4, centerCosts.material, undefined, "material")];
    case "f-industry": return [habitats(3), economicCenters(5)];
    case "f-prospect": return [tech("Exploration", 2), milestone("prospect-4", "Prospect four worlds", "prospect", new Set(player.legacyMetrics.prospectedHexes).size, 4)];
    case "a-web": return [tech("Policy", 1), milestone("agreements-3", "Three agreement partners", "agreement", agreements, 3, { influence: 1 })];
    case "a-service": return [tech("Exploration", 2), milestone("envoys-2", "Envoys in two civilizations", "agreement", new Set(game.civilianUnits.filter((u) => u.owner === playerId && u.type === "envoy").map((u) => game.hexes.find((h) => h.id === u.hex)?.owner).filter((owner) => owner !== undefined && owner !== playerId)).size, 2)];
    case "m-network": return [tech("Policy", 1), milestone("agreements-3", "Three trade partners", "agreement", tradePartners, 3, { influence: 1 })];
    case "b-survey": return [milestone("surveys-6", "Private surveys", "survey", player.privateSurveys.length, 6)];
    case "b-frontier": return [habitats(3)];
    case "v-mobilized": return [milestone("cu-10", "Control 10 CU", "recruit", owned.reduce((sum, hex) => sum + hex.combat, 0) + game.carriers.filter((c) => c.owner === playerId).reduce((sum, c) => sum + c.cu, 0), 10, { currency: 1, labor: 1 })];
    case "renaissance": return [milestone("three-level2", "Three technology branches at II", "technology", Object.values(player.tech).filter((level) => level >= 2).length, 3)];
    case "first-foundations": return [habitats(2), economicCenters(2)];
    default: return [];
  }
}

function milestoneMatch(order: SecretOrder, milestone: ProjectMilestone, game: GameState, playerId: number) {
  if (milestone.action === "technology") return order.kind === "technology" &&
    (milestone.branch ? order.branch === milestone.branch : game.players[playerId].tech[order.branch] < (milestone.key === "three-techs" ? 3 : 2));
  if (milestone.action === "habitat") return order.kind === "establish" || order.kind === "construct" &&
    (order.construction.type === "colony" || order.construction.type === "module");
  if (milestone.action === "develop" || milestone.action === "metro") return order.kind === "construct" &&
    order.construction.type === "upgrade" && game.hexes.some((hex) => hex.id === order.habitatId &&
      (milestone.action === "metro" ? hex.tier === "Colony" : hex.tier === "Outpost"));
  if (milestone.action === "center" && order.kind === "construct") {
    const construction = order.construction;
    return construction.type === "center" && (!milestone.resource || construction.center === milestone.resource) &&
      (milestone.key !== "center-types" || !game.hexes.some((hex) => hex.owner === playerId && hex.centers.includes(construction.center))) ||
      construction.type === "mobileCenter" && (!milestone.resource || construction.center === milestone.resource);
  }
  if (milestone.action === "arcology") return order.kind === "construct" && order.construction.type === "arcology";
  if (milestone.action === "blockade") return order.kind === "construct" && (order.construction.type === "blockade" ||
    order.construction.type === "center" && order.construction.center === "defense");
  if (milestone.action === "mobileHabitat") return order.kind === "construct" && order.construction.type === "mobileHabitat";
  if (milestone.action === "enhanceCenter") return order.kind === "construct" && order.construction.type === "enhanceCenter";
  if (milestone.action === "bombard") return order.kind === "bombard";
  if (milestone.action === "survey") return ["farboundForwardScan", "longRangeSurvey", "explorerScan"].includes(order.kind);
  if (milestone.action === "prospect") return order.kind === "prospect";
  if (milestone.action === "migration") return order.kind === "migration" || order.kind === "construct" && order.construction.type === "mobileCenter";
  if (milestone.action === "factory") return order.kind === "construct" && order.construction.type === "factory";
  if (milestone.action === "recruit") return order.kind === "construct" && order.construction.type === "recruit";
  return false;
}

function funding(game: GameState, playerId: number, step: ProjectMilestone, deadline: number) {
  const player = game.players[playerId], production = productionForecast(game, playerId).totals;
  const turns = Math.min(3, Math.max(0, deadline - game.turn));
  const reserve = game.gate < gateTarget(game) ? tributeCosts[game.era] : {};
  const missing: Partial<Record<Resource, number>> = {}, route: BotProject["route"] = {};
  const available = (resource: Resource) => player.resources[resource] + production[resource] * Math.min(turns, 2) * .65;
  const canTrade = (resource: Resource) => resource !== "influence" && game.players.some((candidate) =>
    candidate.id !== playerId && (candidate.resources[resource] > (tributeCosts[game.era][resource] || 0) + 1 ||
      productionForecast(game, candidate.id).totals[resource] > 0));
  for (const resource of resources) {
    const cost = step.cost[resource] || 0;
    if (!cost) continue;
    const shortage = Math.max(0, Math.ceil(cost + (reserve[resource] || 0) - player.resources[resource] - production[resource] * Math.min(turns, 2) * .65));
    if (!shortage) continue;
    missing[resource] = shortage;
    route[resource] = production[resource] > 0 ? "income" : resource === "influence" ? "infrastructure" :
      canTrade(resource) ? "trade" : "infrastructure";
    // A Center can produce the missing input only after it is built. Trace its
    // purchase cost one layer back so a shortage of Currency does not strand a
    // bot that is waiting to afford Research or a Technology level.
    if (production[resource] === 0 && resource !== "influence" && turns > 1) {
      for (const prerequisite of resources) {
        const centerCost = centerCosts[resource][prerequisite] || 0;
        const prerequisiteShortage = Math.max(0, Math.ceil(centerCost + (reserve[prerequisite] || 0) - available(prerequisite)));
        if (prerequisiteShortage > 0 && prerequisite !== resource) {
          missing[prerequisite] = Math.max(missing[prerequisite] || 0, prerequisiteShortage);
          route[prerequisite] = production[prerequisite] > 0 ? "income" :
            canTrade(prerequisite) ? "trade" : "infrastructure";
        }
      }
    }
  }
  return { missing, route };
}

function projectBudget(game: GameState, playerId: number, steps: ProjectMilestone[], deadline: number): BotProject["budget"] {
  const player = game.players[playerId], production = productionForecast(game, playerId).totals;
  const required = { material: 0, currency: 0, research: 0, influence: 0 };
  let labor = 0, minimumTurns = 0;
  for (const step of steps) {
    const remaining = Math.max(0, step.target - step.current);
    if (!remaining) continue;
    minimumTurns += remaining;
    if (step.action === "technology" && step.branch) {
      for (let level = player.tech[step.branch] + 1; level <= step.target; level++) {
        const cost = technologyCost(game, playerId, step.branch, level);
        for (const resource of resources) required[resource] += cost[resource] || 0;
        labor += cost.labor || 0;
      }
    } else {
      for (const resource of resources) required[resource] += (step.cost[resource] || 0) * remaining;
      labor += (step.cost.labor || 0) * remaining;
    }
  }
  const turns = Math.min(6, Math.max(0, deadline - game.turn));
  const projected = { ...player.resources };
  for (const resource of resources) projected[resource] += production[resource] * turns * .72;
  // One near-term Tribute stays liquid while the project is funded.
  const tribute = game.gate < gateTarget(game) ? tributeCosts[game.era] : {};
  const deficit = { material: 0, currency: 0, research: 0, influence: 0 };
  for (const resource of resources) deficit[resource] = Math.max(0, Math.ceil(required[resource] + (tribute[resource] || 0) - projected[resource]));
  return { required, projected, deficit, labor, minimumTurns };
}

export function createProjectPlan(game: GameState, playerId: number, profile: BotProfile,
  previous: BotProjectMemory[] = []): BotProjectPlan {
  const player = game.players[playerId];
  const factionGoals = civilizationObjectives(player).filter((objective) => !player.civilizationClaims.includes(objective.id));
  const universals = universalLegacy.filter((objective) => objective.era <= game.era &&
    !game.universalClaims.some((claim) => claim.objectiveId === objective.id));
  const templates = [...factionGoals.map((objective) => ({ ...objective, category: "civilization" as const })),
    ...universals.map((objective) => ({ ...objective, category: "universal" as const }))];
  const ranked = templates.flatMap((objective) => {
    const steps = projectSteps(game, playerId, objective.id);
    if (!steps.length) return [];
    const next = steps.find((step) => step.current < step.target);
    if (!next) return [];
    const progress = legacyObjectiveProgress(game, playerId, objective.id);
    const deadline = totalTurns(game);
    const budget = projectBudget(game, playerId, steps, deadline);
    const work = budget.minimumTurns;
    const time = deadline - game.turn + 1;
    if (time <= 0 || work > time * 2.4) return [];
    const committed = previous.find((item) => item.id === objective.id);
    const feasibility = Math.max(.12, Math.min(1, time / Math.max(1, work * 1.1)));
    const factionRank = factionGoals.findIndex((candidate) => candidate.id === objective.id);
    const resourcePressure = Object.values(budget.deficit).reduce((sum, value) => sum + value, 0);
    const externalDependency = ["ae-arms", "a-service", "m-network"].includes(objective.id) ? 13 : 0;
    const score = objective.lp * 14 * feasibility / (1 + work * .24) + (progress.target ? progress.current / progress.target : 0) * 18 +
      (committed ? 13 : 0) + (objective.category === "civilization" ? 12 + Math.max(0, 16 - factionRank * 7) : 0) -
      Math.max(0, work - time) * 6 - Math.min(16, resourcePressure * 1.5) - externalDependency +
      (factionRules(player) === "spires" && objective.id === "sp-arcology" ? 130 : 0);
    const financing = funding(game, playerId, next, deadline);
    return [{ id: objective.id, name: objective.name, category: objective.category, lp: objective.lp,
      deadline, milestones: steps, next, score, budget, ...financing } satisfies BotProject];
  }).sort((a, b) => b.score - a.score);
  const count = profile.difficulty === "emperor" ? 4 : profile.difficulty === "hard" ? 3 : profile.difficulty === "medium" ? 2 : 1;
  const factions = ranked.filter((project) => project.category === "civilization").slice(0, Math.max(1, Math.ceil(count / 2)));
  const others = ranked.filter((project) => project.category === "universal");
  const projects = [...factions, ...others.slice(0, Math.max(0, count - factions.length))].slice(0, count);
  const commitments = projects.map((project) => {
    const old = previous.find((item) => item.id === project.id);
    return { id: project.id, committedTurn: old?.committedTurn ?? game.turn,
      lastProgress: legacyObjectiveProgress(game, playerId, project.id).current };
  });
  return { projects, commitments };
}

export function projectOrderBonus(game: GameState, playerId: number, order: SecretOrder, projects: BotProject[]) {
  let score = 0;
  const reasons: string[] = [];
  for (const [rank, project] of projects.entries()) {
    const weight = rank === 0 ? 1 : rank === 1 ? .68 : .36;
    if (milestoneMatch(order, project.next, game, playerId)) {
      const bonus = (project.category === "civilization" ? 76 : 53) * weight;
      score += bonus;
      reasons.push(`${project.name}: ${project.next.label}`);
    } else if (project.milestones.slice(project.milestones.indexOf(project.next) + 1, project.milestones.indexOf(project.next) + 3)
      .some((step) => step.current < step.target && milestoneMatch(order, step, game, playerId))) {
      score += 22 * weight;
      reasons.push(`${project.name}: prepares a later milestone`);
    }
    if (order.kind === "construct" && ["center", "mobileCenter"].includes(order.construction.type)) {
      const center = order.construction.type === "center" || order.construction.type === "mobileCenter" ? order.construction.center : undefined;
      if (center && center !== "defense" && project.missing[center as Resource] && project.route[center as Resource] === "infrastructure" &&
        game.turn <= project.deadline - 2) {
        score += 50 * weight;
        reasons.push(`${project.name}: creates a recurring source of ${center}`);
      }
    }
  }
  return { score: Math.min(155, score), reasons };
}
