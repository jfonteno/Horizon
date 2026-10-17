import { factionRules } from "../factions";
import {
  civilizationObjectives,
  hiddenLegacyDeck,
  legacyObjectiveProgress,
  universalLegacy,
} from "../rules/legacy";
import { gateTarget, totalTurns } from "../rules/format";
import type { GameState, SecretOrder } from "../types";
import type {
  BotActionTag,
  BotGoal,
  BotGoalCategory,
  BotObjectivePlan,
  BotProfile,
} from "./types";

const tagPatterns: Array<[BotActionTag, RegExp]> = [
  ["explore", /explor|reveal|frontier|non-homeworld/],
  ["survey", /survey|reveal/],
  ["establish", /establish|habitat|colon|frontier/],
  ["develop", /develop|upgrade|metropolis|center|habitat/],
  ["center", /center|produc|economic/],
  ["technology", /technology|branch|level [ivx]+/],
  ["military", /\bcu\b|military|arsenal|capacity|force|vessel/],
  ["recruit", /\bcu\b|recruit|military/],
  ["carrier", /carrier|vessel|capacity|fleet/],
  ["combat", /combat|capture|conquer|win against|rival homeworld/],
  ["trade", /trade|provide|transfer|export|broker|sell|commerce/],
  ["agreement", /agreement|alliance|diplomatic|envoy|coalition/],
  ["tribute", /tribute|gate|horizon/],
  ["prospect", /prospect/],
  ["defend", /defen|retain|peace|without initiating/],
  ["material", /material/],
  ["currency", /currency|market/],
  ["research", /research|technology/],
  ["influence", /influence|agreement|diplomatic/],
  ["labor", /labor/],
];

const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));

export function inferObjectiveTags(condition: string, objectiveId = ""): BotActionTag[] {
  const text = `${objectiveId} ${condition}`.toLowerCase();
  const tags = tagPatterns.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
  return [...new Set(tags.length ? tags : ["develop" as const])];
}

function factionAffinity(game: GameState, playerId: number, tags: BotActionTag[]) {
  const rules = factionRules(game.players[playerId]);
  const preferred: Record<string, BotActionTag[]> = {
    varkesh: ["military", "recruit", "carrier", "combat", "defend"],
    helix: ["technology", "research", "center", "trade"],
    foundry: ["develop", "center", "material", "prospect", "establish"],
    aurelians: ["agreement", "trade", "influence"],
    meridian: ["trade", "agreement", "currency"],
    farbound: ["explore", "survey", "establish", "trade"],
    spires: ["develop", "center", "defend"],
    aegis: ["defend", "agreement", "carrier"],
    wayfarers: ["explore", "develop", "establish", "defend"],
    salvo: ["military", "combat", "carrier"],
    guilds: ["develop", "center", "material", "currency", "research"],
  };
  return tags.reduce((sum, tag) => sum + (preferred[rules]?.includes(tag) ? 1 : 0), 0) / Math.max(1, tags.length);
}

function makeGoal(
  game: GameState,
  playerId: number,
  profile: BotProfile,
  objective: { id: string; name: string; lp: number; condition: string; era?: number },
  category: BotGoalCategory,
): BotGoal {
  const progress = legacyObjectiveProgress(game, playerId, objective.id);
  const completion = progress.target ? clamp(progress.current / progress.target) : 0;
  const tags = inferObjectiveTags(objective.condition, objective.id);
  const affinity = factionAffinity(game, playerId, tags);
  const deadlineTurn = category === "hidden"
    ? Math.min(totalTurns(game), (objective.era || game.era) * 4)
    : totalTurns(game);
  const turnsLeft = Math.max(1, deadlineTurn - game.turn + 1);
  const remaining = Math.max(0, progress.target - progress.current);
  const pace = remaining / turnsLeft;
  const rivalCompletion = category === "universal" ? Math.max(0, ...game.players
    .filter((player) => player.id !== playerId)
    .map((player) => {
      const rival = legacyObjectiveProgress(game, player.id, objective.id);
      return rival.target ? rival.current / rival.target : 0;
    })) : 0;
  const raceAdjustment = category === "universal" ? (completion - rivalCompletion) * .22 : 0;
  const feasibility = progress.complete ? 1 : clamp(0.62 + completion * 0.22 + affinity * 0.12 - pace * 0.5 + raceAdjustment, 0.08, 0.98);
  const exclusivity = category === "universal" ? 10 : 0;
  const racePressure = category === "universal" && rivalCompletion >= .5 ? 14 + rivalCompletion * 12 : 0;
  const urgency = category === "hidden" ? Math.max(0, 5 - turnsLeft) * 6 : 0;
  const score = objective.lp * 10 * profile.priorities.legacy * feasibility + completion * 30 + affinity * 18 + exclusivity + urgency + racePressure;
  return {
    objectiveId: objective.id,
    name: objective.name,
    category,
    lp: objective.lp,
    progress: progress.current,
    target: progress.target,
    completion,
    feasibility,
    deadlineTurn,
    score,
    tags,
    reason: `${progress.label}; ${Math.round(feasibility * 100)}% estimated feasibility${category === "universal" ? `; strongest rival ${Math.round(rivalCompletion * 100)}%` : ""}; ${tags.join(", ")} actions`,
  };
}

export function scoreHiddenChoice(game: GameState, playerId: number, profile: BotProfile, cardId: string) {
  const card = hiddenLegacyDeck.find((candidate) => candidate.id === cardId);
  if (!card) return { score: -Infinity, reason: "Unknown Hidden objective." };
  const goal = makeGoal(game, playerId, profile, card, "hidden");
  const player = game.players[playerId];
  const habitats = game.hexes.filter((hex) => hex.owner === playerId && hex.tier).length;
  const levelThree = Object.values(player.tech).filter((level) => level >= 3).length;
  const levelFour = Object.values(player.tech).filter((level) => level >= 4).length;
  const activeAgreementCount = game.agreements.filter((agreement) => agreement.parties.includes(playerId) &&
    (agreement.endsAfterTurn === undefined || agreement.endsAfterTurn >= game.turn)).length;
  const progressPenalty = cardId === "h2-colonial" && habitats < 2 ? 72 :
    cardId === "h2-colonial" && player.modules < 1 ? 30 :
    cardId === "h3-broker" && activeAgreementCount < 1 ? 42 :
    cardId === "h4-complete" && (levelThree < 2 || habitats < 2) ? 65 :
    cardId === "h3-tech" && levelFour < 1 && Object.values(player.tech).reduce((sum, level) => sum + level, 0) < 8 ? 34 :
    cardId === "h4-science" && levelFour < 1 ? 36 : 0;
  const earlyCommitmentPenalty: Record<string, number> = {
    "h2-colonial": 32,
    "h3-broker": 30,
    "h3-conqueror": 36,
    "h4-complete": 54,
    "h4-conquest": 42,
    "h4-great": 42,
  };
  const penalty = goal.progress === 0 ? (earlyCommitmentPenalty[cardId] || 0) : 0;
  const feasibilityPenalty = goal.feasibility < .35 ? 108 : goal.feasibility < .5 ? 58 : goal.feasibility < .65 ? 24 : 0;
  const structuralPenalty =
    cardId === "h2-colonial" && habitats < 2 ? 92 :
    cardId === "h4-complete" && (levelThree < 2 || habitats < 2) ? 64 :
    cardId === "h3-tech" && Math.max(...Object.values(player.tech)) < 2 ? 52 : 0;
  const turnsLeft = Math.max(1, goal.deadlineTurn - game.turn + 1);
  const colonySite = game.hexes.find((hex) => player.colonyShips.some((unit) => unit.hex === hex.id) && hex.revealed && hex.owner === undefined && ["material", "currency", "research", "influence", "labor"].includes(hex.kind));
  const readySite = colonySite?.revealed && colonySite.owner === undefined && ["material", "currency", "research", "influence", "labor"].includes(colonySite.kind);
  const neededHabitats = cardId === "h2-colonial" ? Math.max(0, 3 - habitats) :
    cardId === "h4-expansion" ? Math.max(0, 2 - player.legacyMetrics.habitatsEstablished[game.era - 1] - player.legacyMetrics.habitatsCaptured[game.era - 1]) : 0;
  const expansionWork = neededHabitats * 3 + Math.max(0, neededHabitats - player.modules) - (readySite ? 1 : 0);
  const actionPenalty = neededHabitats && expansionWork > turnsLeft ? 80 + (expansionWork - turnsLeft) * 15 :
    cardId === "h3-builder" && player.tech.Resource < 2 ? 80 :
    ["h3-conqueror", "h4-conquest"].includes(cardId) && !game.carriers.some((carrier) => carrier.owner === playerId && carrier.cu >= 5) ? 80 : 0;
  return { score: goal.score - penalty - progressPenalty - feasibilityPenalty - structuralPenalty - actionPenalty,
    reason: `${goal.reason}${penalty ? `; early commitment penalty ${penalty}` : ""}${progressPenalty ? `; readiness penalty ${progressPenalty}` : ""}${structuralPenalty ? `; structural readiness penalty ${structuralPenalty}` : ""}${actionPenalty ? `; action feasibility penalty ${actionPenalty}` : ""}`, goal };
}

export function createObjectivePlan(game: GameState, playerId: number, profile: BotProfile): BotObjectivePlan {
  const player = game.players[playerId];
  const advanced = profile.difficulty === "hard" || profile.difficulty === "emperor";
  const targetCount = profile.difficulty === "emperor" ? 3 : advanced ? 3 : profile.difficulty === "easy" ? 1 : 2;
  const hiddenId = player.hiddenLegacy[game.era]?.selected;
  const hiddenCard = hiddenLegacyDeck.find((card) => card.id === hiddenId);
  const hiddenGoals = hiddenCard ? [makeGoal(game, playerId, profile, hiddenCard, "hidden")] : [];
  const universalGoals = universalLegacy
    .filter((objective) => objective.era <= game.era && !game.universalClaims.some((claim) => claim.objectiveId === objective.id))
    .map((objective) => makeGoal(game, playerId, profile, objective, "universal"))
    .sort((a, b) => b.score - a.score)
    .slice(0, targetCount);
  const civilizationGoals = civilizationObjectives(player)
    .filter((objective) => !player.civilizationClaims.includes(objective.id))
    .map((objective) => makeGoal(game, playerId, profile, objective, "civilization"))
    .sort((a, b) => b.score - a.score)
    .slice(0, targetCount);
  const remainingGate = Math.max(0, gateTarget(game) - game.gate);
  const gateGoal: BotGoal[] = remainingGate ? [{
    objectiveId: "horizon-gate",
    name: "Complete the Horizon Gate",
    category: "gate",
    lp: 0,
    progress: game.gate,
    target: gateTarget(game),
    completion: game.gate / Math.max(1, gateTarget(game)),
    feasibility: 1,
    deadlineTurn: totalTurns(game),
    score: 36 * profile.priorities.gate,
    tags: ["tribute", "trade", "material", "currency", "research"],
    reason: `${remainingGate} shared Tributes remain.`,
  }] : [];
  const goals = [...hiddenGoals, ...universalGoals, ...civilizationGoals, ...gateGoal];
  const actionWeights: Partial<Record<BotActionTag, number>> = {};
  for (const goal of goals) {
    const categoryWeight = goal.category === "hidden" ? (profile.difficulty === "emperor" ? 1.55 : 1.35) : goal.category === "civilization" ? 1.2 : goal.category === "gate" ? 0.8 : 1;
    const categoryRank = goals.filter((candidate) => candidate.category === goal.category).indexOf(goal);
    const focus = profile.difficulty === "emperor" ? 1 / (1 + categoryRank * .9) : 1;
    const remainingWeight = goal.completion >= 1 ? .08 : 1;
    for (const tag of goal.tags) actionWeights[tag] = (actionWeights[tag] || 0) + goal.score * categoryWeight * focus * remainingWeight / Math.max(1, goal.tags.length);
  }
  // A shared action can advance multiple scoring tracks. Reward this overlap
  // only at the levels that deliberately pursue compound objectives.
  if (advanced) for (const tag of Object.keys(actionWeights) as BotActionTag[]) {
    const distinct = new Set(goals.filter((goal) => goal.lp > 0 && goal.completion < 1 && goal.tags.includes(tag)).map((goal) => goal.category));
    if (distinct.size >= 2) actionWeights[tag] = (actionWeights[tag] || 0) *
      (profile.difficulty === "emperor" ? 1.3 : 1.14);
  }
  return {
    generatedTurn: game.turn,
    primaryGoalIds: goals.filter((goal) => goal.category !== "gate").map((goal) => goal.objectiveId),
    goals,
    actionWeights,
    expectedLP: goals.filter((goal) => goal.lp > 0).reduce((sum, goal) => sum + goal.lp * goal.feasibility, 0),
  };
}

export function objectiveActionBonus(plan: BotObjectivePlan, tags: BotActionTag[]) {
  const raw = tags.reduce((sum, tag) => sum + (plan.actionWeights[tag] || 0), 0);
  const focused = plan.goals
    .filter((goal) => goal.category === "hidden" && goal.completion < 1 && goal.tags.some((tag) => tags.includes(tag)))
    .reduce((sum, goal) => sum + goal.score, 0);
  const primary = plan.goals.find((goal) => goal.category === "hidden");
  const overlap = primary && primary.completion < 1 ? primary.tags.filter((tag) => tags.includes(tag)).length : 0;
  return Math.min(160, raw * 0.08 + focused * 0.22 + overlap * 10);
}

/** Score a deterministic state change against the same requirements used to award LP. */
export function measurableObjectiveBonus(game: GameState, playerId: number, order: SecretOrder, plan: BotObjectivePlan) {
  if (!["technology", "tribute", "establish", "explorerMove", "migration", "construct"].includes(order.kind))
    return { score: 0, advanced: [] as string[] };
  const relevant = plan.goals.filter((goal) => goal.lp > 0 && goal.completion < 1);
  if (!relevant.length) return { score: 0, advanced: [] as string[] };
  const player = game.players[playerId];
  const next = { ...game, players: [...game.players], hexes: [...game.hexes], mobileHabitats: [...game.mobileHabitats] };
  const subject = { ...player, tech: { ...player.tech }, eraTributes: [...player.eraTributes],
    legacyMetrics: structuredClone(player.legacyMetrics) };
  next.players[playerId] = subject;
  const metrics = subject.legacyMetrics, era = game.era - 1;
  const changeHex = (id: string) => {
    const index = next.hexes.findIndex((hex) => hex.id === id);
    if (index < 0) return undefined;
    next.hexes[index] = { ...next.hexes[index], centers: [...next.hexes[index].centers] };
    return next.hexes[index];
  };
  if (order.kind === "technology") {
    subject.tech[order.branch]++;
    metrics.technologyAdvances[era].push(order.branch);
  } else if (order.kind === "tribute") {
    subject.tributes++;
    subject.eraTributes[era]++;
    next.gate++;
  } else if (order.kind === "establish") {
    const hex = changeHex(order.hexId);
    if (!hex || hex.owner !== undefined) return { score: 0, advanced: [] as string[] };
    hex.owner = playerId;
    hex.tier = "Outpost";
    metrics.habitatsEstablished[era]++;
  } else if (order.kind === "explorerMove") {
    const hex = changeHex(order.destination);
    if (!hex || hex.revealed) return { score: 0, advanced: [] as string[] };
    hex.revealed = true;
    metrics.revealedHexes[era]++;
  } else if (order.kind === "migration") {
    metrics.wayfarerMigrationHexes.push(order.destination);
    const index = next.mobileHabitats.findIndex((mobile) => mobile.id === order.mobileHabitatId);
    if (index >= 0) {
      next.mobileHabitats[index] = { ...next.mobileHabitats[index], hex: order.destination };
      metrics.wayfarerRelocatedCenters += next.mobileHabitats[index].centers.length;
    }
  } else if (order.kind === "construct") {
    const hex = changeHex(order.habitatId);
    const construction = order.construction;
    if (!hex) return { score: 0, advanced: [] as string[] };
    if (construction.type === "center") {
      hex.centers.push(construction.center);
      if (construction.center === "defense" && ["spires", "aegis"].includes(factionRules(subject)))
        hex.defenseGridOrigin = factionRules(subject) as "spires" | "aegis";
      metrics.builtCenters[era]++;
      metrics.habitatDevelopmentHexes[era].push(hex.id);
    } else if (construction.type === "upgrade") {
      hex.tier = hex.tier === "Outpost" ? "Colony" : "Metropolis";
      metrics.upgradedHabitats[era]++;
      metrics.habitatDevelopmentHexes[era].push(hex.id);
    } else if (construction.type === "recruit") {
      hex.combat += construction.pairs * 2;
      metrics.recruitedCU[era] += construction.pairs * 2;
    } else if (construction.type === "mobileCenter") {
      const index = next.mobileHabitats.findIndex((mobile) => mobile.id === construction.mobileHabitatId);
      if (index >= 0) next.mobileHabitats[index] = { ...next.mobileHabitats[index], centers: [...next.mobileHabitats[index].centers, construction.center] };
    } else if (construction.type === "mobileHabitat") {
      const existing = next.mobileHabitats.find((mobile) => mobile.owner === playerId);
      if (!existing) return { score: 0, advanced: [] as string[] };
      next.mobileHabitats.push({ ...existing, id: `forecast-${order.id}`, type: construction.vessel,
        hex: order.habitatId, centers: [] });
    } else if (construction.type === "arcology") {
      hex.tier = "Arcology";
    } else return { score: 0, advanced: [] as string[] };
  } else return { score: 0, advanced: [] as string[] };
  let score = 0;
  const advanced: string[] = [];
  for (const goal of relevant) {
    const after = legacyObjectiveProgress(next, playerId, goal.objectiveId);
    const delta = Math.max(0, Math.min(goal.target, after.current) - goal.progress);
    if (!delta) continue;
    const weight = goal.category === "hidden" ? 1.2 : goal.category === "civilization" ? 1.25 : 1;
    score += (32 + goal.lp * 9 / Math.max(1, goal.target)) * delta * weight * goal.feasibility;
    if (after.complete) score += goal.lp * 5 * weight;
    advanced.push(goal.name);
  }
  return { score: Math.min(240, score), advanced };
}

export function orderObjectiveTags(order: SecretOrder): BotActionTag[] {
  switch (order.kind) {
    case "explorerMove": return ["explore", "survey"];
    case "explorerScan":
    case "farboundForwardScan":
    case "wayfarerDeepRecon":
    case "longRangeSurvey": return ["survey", "explore"];
    case "colonyMove": return ["establish", "explore"];
    case "establish": return ["establish", "develop"];
    case "prospect": return ["prospect", "material"];
    case "carrierMove": return ["military", "combat", "defend"];
    case "migration": return ["develop", "explore"];
    case "bombard": return ["military", "combat"];
    case "factoryOutput": return ["develop", "center"];
    case "transferBlockade": return ["agreement", "defend"];
    case "blockadeCargo": return ["defend", "military"];
    case "civilianMove": return ["agreement", "prospect", "survey"];
    case "technology": return ["technology", order.branch === "Policy" ? "influence" : order.branch === "Military" || order.branch === "Resource" ? "material" : "research"];
    case "tribute": return ["tribute"];
    case "construct": {
      if (order.construction.type === "center") return ["develop", "center", order.construction.center === "defense" ? "defend" : order.construction.center === "factory" ? "develop" : order.construction.center];
      if (["upgrade", "module", "colony"].includes(order.construction.type)) return ["develop", "establish"];
      if (order.construction.type === "recruit") return ["military", "recruit", "defend"];
      if (order.construction.type === "carrier") return ["military", "carrier"];
      if (order.construction.type === "civilian") return [order.construction.civilian === "envoy" ? "agreement" : order.construction.civilian === "prospector" ? "prospect" : "survey"];
      if (order.construction.type === "mobileCenter") return ["develop", "center", order.construction.center];
      if (order.construction.type === "mobileHabitat") return ["develop", "establish", "carrier"];
      if (order.construction.type === "caravanGuard" || order.construction.type === "blockade") return ["defend", "military"];
      if (order.construction.type === "arcology") return ["develop", "establish"];
      if (order.construction.type === "factory" || order.construction.type === "enhanceCenter") return ["develop", "center"];
      return ["explore", "survey"];
    }
    default: return [];
  }
}
