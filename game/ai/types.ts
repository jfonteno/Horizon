import type { SecretOrder, TechnologyBranch } from "../types";

export type BotDifficulty = "easy" | "medium" | "hard" | "emperor" | "novice" | "standard" | "advanced" | "expert";

export type BotProfile = {
  profileVersion: 1;
  id: string;
  name: string;
  description: string;
  difficulty: BotDifficulty;
  planning: {
    beamWidth: number;
    candidateLimit: number;
    maxOrders: number;
    threatHorizon: number;
    riskTolerance: number;
    reserveByEra: [number, number, number, number];
    uncertaintyPenalty: number;
    diplomacyHorizon: number;
    gateSafetyMargin: number;
    forecastHorizon: number;
    minimumGateConfidence: number;
  };
  priorities: {
    legacy: number;
    economy: number;
    technology: number;
    expansion: number;
    military: number;
    diplomacy: number;
    gate: number;
    denial: number;
    survival: number;
  };
  technology: Record<TechnologyBranch, number>;
  behaviors: {
    punishFreeRiders: boolean;
    avoidMutualDestruction: boolean;
    protectGateCompletion: boolean;
    preferFlexibleResources: boolean;
    exploitFactionSynergy: boolean;
    recordCounterfactuals: boolean;
    coordinateGateSupport: boolean;
    useMarketForGate: boolean;
    modelOpponents: boolean;
    routeColonies: boolean;
    redTeamNotebook: boolean;
    multiTurnPlanning: boolean;
    factionDoctrine: boolean;
    victoryImpact: boolean;
  };
};

export type BotArchetype = "runaway" | "militarist" | "expansionist" | "broker" | "gate-steward" | "free-rider" | "balanced";

export type BotActionTag =
  | "explore"
  | "survey"
  | "establish"
  | "develop"
  | "center"
  | "technology"
  | "military"
  | "recruit"
  | "carrier"
  | "combat"
  | "trade"
  | "agreement"
  | "tribute"
  | "prospect"
  | "defend"
  | "material"
  | "currency"
  | "research"
  | "influence"
  | "labor";

export type BotGoalCategory = "hidden" | "universal" | "civilization" | "gate";

export type BotGoal = {
  objectiveId: string;
  name: string;
  category: BotGoalCategory;
  lp: number;
  progress: number;
  target: number;
  completion: number;
  feasibility: number;
  deadlineTurn: number;
  score: number;
  tags: BotActionTag[];
  reason: string;
};

export type BotObjectivePlan = {
  generatedTurn: number;
  primaryGoalIds: string[];
  goals: BotGoal[];
  actionWeights: Partial<Record<BotActionTag, number>>;
  expectedLP: number;
};

export type BotStance = "cooperate" | "selective" | "contain" | "deter" | "gate-support" | "exploit";

export type BotOpponentModel = {
  playerId: number;
  observedTurn: number;
  lp: number;
  lpTrend: number;
  military: number;
  habitats: number;
  tributes: number;
  aggression: number;
  tradeReliability: number;
  gateReliability: number;
  archetypes: BotArchetype[];
  production: number;
  technology: number;
  agreements: number;
  objectivePressure: number;
  victoryThreat: number;
  scoreFloor: number;
  scoreCeiling: number;
  tradeFit: number;
  dependencyRisk: number;
  gateRisk: number;
  relationship: number;
  stance: BotStance;
};

export type BotCommitment = {
  partnerId: number;
  createdTurn: number;
  expiresTurn: number;
  purpose: "gate-support" | "resource-route" | "trade-network" | "coalition";
  detail: string;
  status: "planned" | "offered" | "completed" | "expired";
};

export type BotMemoryState = {
  playerId: number;
  updatedTurn: number;
  opponents: BotOpponentModel[];
  commitments: BotCommitment[];
  metaFlags: string[];
  projects?: import("./projects").BotProjectMemory[];
  strategy?: BotStrategicPlan;
};

export type BotStrategicPlan = {
  generatedTurn: number;
  difficulty: BotDifficulty;
  horizonTurns: number;
  doctrine: string;
  gateEmergency: boolean;
  gateConfidence: number;
  collectiveProjectedTributes: number;
  personalContributionTarget: number;
  contributionDueTurn: number;
  reserve: Record<"material" | "currency" | "research" | "influence", number>;
  followupReserve: Record<"material" | "currency" | "research" | "influence", number>;
  gateDemand: Record<"material" | "currency" | "research" | "influence", number>;
  projectedDeficits: Partial<Record<"material" | "currency" | "research" | "influence", number>>;
  priorityResources: Array<"material" | "currency" | "research" | "influence">;
  leaderId?: number;
  victoryPressure: number;
  objectivePlan: BotObjectivePlan;
  projectPlan: import("./projects").BotProjectPlan;
  priorities: BotPriority[];
  defenseNeeds: Record<string, number>;
};

export type BotPriorityKey = "agreement" | "trade" | "influence" | "economicCenters" |
  "resourceTechnology" | "policyTechnology" | "militaryTechnology" | "upgrade" |
  "recruit" | "expand" | "explore" | "mobileCenters" | "tribute";

export type BotPriority = { key: BotPriorityKey; weight: number; reason: string };

export type BotCandidate = {
  id: string;
  order: SecretOrder;
  score: number;
  reasons: string[];
  conflicts: string[];
  counterfactual?: string;
};

export type BotOrderAssessment = {
  label: string;
  score: number;
  reasons: string[];
};

export type BotDecisionReport = {
  id: string;
  turn: number;
  era: number;
  playerId: number;
  profileId: string;
  profileName: string;
  posture: string;
  confidence: number;
  candidateCount: number;
  planningNodes: number;
  hiddenObjectiveId?: string;
  hiddenObjectiveReason?: string;
  selectedOrders: BotOrderAssessment[];
  rejectedAlternatives: BotOrderAssessment[];
  threats: string[];
  gateAnalysis: string;
  diplomacy: string[];
  opponentModels: string[];
  commitments: string[];
  metaFlags: string[];
  strategicForecast: string[];
  goalAnalysis: string[];
  knowledgeBoundary: string;
  submissionOk: boolean;
  submissionMessage: string;
};

export type BotTurnPlan = {
  orders: SecretOrder[];
  report: BotDecisionReport;
};

export function validateBotProfile(value: unknown): value is BotProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<BotProfile>;
  return profile.profileVersion === 1 &&
    typeof profile.id === "string" && /^[a-z][a-z0-9-]+$/.test(profile.id) &&
    typeof profile.name === "string" &&
    !!profile.planning && profile.planning.beamWidth > 0 &&
    profile.planning.candidateLimit > 0 && profile.planning.maxOrders > 0 &&
    Array.isArray(profile.planning.reserveByEra) && profile.planning.reserveByEra.length === 4 &&
    profile.planning.diplomacyHorizon > 0 && profile.planning.gateSafetyMargin >= 0 &&
    profile.planning.forecastHorizon > 0 && profile.planning.minimumGateConfidence > 0 &&
    !!profile.priorities && !!profile.technology && !!profile.behaviors;
}
