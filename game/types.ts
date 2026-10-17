export type Resource = "material" | "currency" | "research" | "influence";
export type HexKind =
  | Resource
  | "labor"
  | "barren"
  | "anomaly"
  | "hazard"
  | "empty"
  | "home"
  | "rift";
export type HabitatTier = "Outpost" | "Colony" | "Metropolis" | "Arcology";
export type CenterType = Resource | "labor" | "defense" | "factory";
export type CommandMode =
  | "inspect"
  | "explore"
  | "colony"
  | "fleet"
  | "establish";
export type TechnologyBranch =
  | "Military"
  | "Economy"
  | "Policy"
  | "Exploration"
  | "Resource";
export type CarrierType =
  | "patrol"
  | "transport"
  | "frigate"
  | "assault"
  | "cruiser"
  | "heavyTransport"
  | "battleship"
  | "fleetTransport"
  | "corvette"
  | "xebec"
  | "blockadeTender"
  | "bombardFrigate"
  | "siegeCruiser"
  | "siegeTender"
  | "gunneryPlatform";
export type MobileHabitatType = "arkship" | "grandArk" | "worldship";
export type TradableResource = "material" | "currency" | "research";
export type TradeBundle = Record<TradableResource | "labor", number> & { influence?: number };
export type AgreementType =
  | "trade"
  | "nonAggression"
  | "openBorders"
  | "research"
  | "defensive"
  | "alliance";
export type CivilianUnitType = "prospector" | "envoy" | "surveyor";
export type ExplorationVesselType = "exploration" | "survey" | "deepSurvey" | "pathfinder";
export type ExplorationVesselState = {
  id: string;
  owner: number;
  type: ExplorationVesselType;
  hex: string;
  readyTurn: number;
  movesRemaining: number;
  portalUsedTurn?: number;
  publicRevealsTurn?: number;
  publicReveals?: number;
};
export type ColonyShipState = {
  id: string;
  owner: number;
  hex: string;
  readyTurn: number;
  movesRemaining: number;
  portalUsedTurn?: number;
};
export type CivilianUnitState = {
  id: string;
  owner: number;
  type: CivilianUnitType;
  hex: string;
  readyTurn: number;
  movesRemaining: number;
  usedTurn?: number;
};
export type PrivateSurvey = {
  hexId: string;
  kind: HexKind;
  surveyedTurn: number;
  /** Negotiation intel can be exchanged only on this Turn. Long-range surveys remain archived. */
  tradableTurn?: number;
  soldTo: number[];
};

export type SecretOrder =
  | { id: string; kind: "hold"; label?: string }
  | { id: string; kind: "explorerMove"; destination: string; vesselId?: string; path?: string[] }
  | { id: string; kind: "explorerScan"; vesselId?: string; hexIds: string[] }
  | { id: string; kind: "farboundForwardScan"; vesselId?: string; hexId: string }
  | { id: string; kind: "colonyMove"; vesselId?: string; destination: string; path?: string[] }
  | {
      id: string;
      kind: "carrierMove";
      carrierIds: string[];
      destination: string;
      path?: string[];
    }
  | {
      id: string;
      kind: "civilianMove";
      unitId: string;
      destination: string;
    }
  | {
      id: string;
      kind: "longRangeSurvey";
      unitId: string;
      hexId: string;
    }
  | { id: string; kind: "establish"; vesselId?: string; hexId: string }
  | { id: string; kind: "migration"; mobileHabitatId: string; destination: string }
  | { id: string; kind: "wayfarerDeepRecon"; vesselId?: string; hexId: string }
  | { id: string; kind: "bombard"; carrierId: string; targetHexId: string; targetPlayerId?: number; strength?: 1 | 2 }
  | { id: string; kind: "factoryOutput"; habitatId: string; factoryIndex: number; output: TradableResource }
  | { id: string; kind: "transferBlockade"; blockadeId: string; toPlayerId: number }
  | { id: string; kind: "blockadeCargo"; blockadeId: string; carrierId: string; action: "load" | "deploy" }
  | { id: string; kind: "prospect"; unitId: string }
  | { id: string; kind: "openPortal"; vesselId: string; replaceCenterIndex?: number }
  | { id: string; kind: "policyVote"; policyId: string; influence: number }
  | {
      id: string;
      kind: "construct";
      habitatId: string;
      construction:
        | { type: "module" }
        | { type: "upgrade" }
        | { type: "center"; center: CenterType }
        | { type: "carrier"; carrier: CarrierType }
        | { type: "recruit"; pairs: number }
        | { type: "colony" }
        | { type: "civilian"; civilian: CivilianUnitType }
        | { type: "exploration"; vessel: ExplorationVesselType }
        | { type: "arcology" }
        | { type: "removeCenter"; centerIndex: number }
        | { type: "replaceCenter"; centerIndex: number; center: CenterType }
        | { type: "enhanceCenter"; centerIndex: number }
        | { type: "factory" }
        | { type: "mobileHabitat"; vessel: MobileHabitatType }
        | { type: "mobileCenter"; mobileHabitatId: string; center: Resource | "labor" }
        | { type: "blockade" }
        | { type: "caravanGuard"; mobileHabitatId: string };
    }
  | { id: string; kind: "technology"; branch: TechnologyBranch }
  | { id: string; kind: "tribute" };

export type SecretOrderSubmission = {
  playerId: number;
  turn: number;
  sealedAt: string;
  orders: SecretOrder[];
};

export type OrderProtocol = {
  phase: "negotiation" | "orders" | "ready" | "resolved";
  turn: number;
  currentPlayer: number;
  submissions: SecretOrderSubmission[];
  lastResolution: string[];
};

export type FormalAgreement = {
  id: string;
  type: AgreementType;
  parties: [number, number];
  startedTurn: number;
  endsAfterTurn?: number;
};

type ProposalBase = {
  id: string;
  createdTurn: number;
  status: "pending" | "accepted" | "rejected" | "cancelled";
};

export type TradeProposal = ProposalBase & {
  kind: "trade";
  from: number;
  to: number;
  offer: TradeBundle;
  request: TradeBundle;
  /** Links a counteroffer to the proposal that caused it. */
  counterOf?: string;
  /** Counter chains are deliberately bounded to prevent negotiation loops. */
  counterDepth?: number;
  expiresAfterTurn?: number;
  /** Optional Aegis platform sold as part of this accepted trade. */
  blockadeId?: string;
  /** A new Blockade built at the buyer's selected hex when the offer is accepted. */
  blockadeCommission?: boolean;
};

export type AgreementProposal = ProposalBase & {
  kind: "agreement";
  from: number;
  to: number;
  agreementType: AgreementType;
};

export type TechnologyProposal = ProposalBase & {
  kind: "technology";
  seller: number;
  buyer: number;
  branch: TechnologyBranch;
  level: number;
  compensation: Record<TradableResource, number>;
};

export type DiplomacyProposal =
  | TradeProposal
  | AgreementProposal
  | TechnologyProposal;

export type BrokerageOffer = {
  id: string;
  meridianId: number;
  a: number;
  b: number;
  aGives: TradeBundle;
  bGives: TradeBundle;
  approvedBy: number[];
  createdTurn: number;
  status: "pending" | "accepted" | "rejected" | "cancelled";
};

export type PlayerDiplomacy = {
  contacts: number[];
  firstAgreementPartners: number[];
  firstTradeAgreementUsed: boolean;
  politicalLaborEras: number[];
  researchDiscountEras: number[];
  technologyExportPartners: number[];
  bonusInfluenceGained?: number;
};

export type LegacyCategory =
  | "universal"
  | "civilization"
  | "hidden"
  | "faction"
  | "manual";
export type LegacyBreakdown = Record<LegacyCategory, number>;

export type PlayerLegacyMetrics = {
  habitatsEstablished: number[];
  habitatsCaptured: number[];
  metropolisCaptured: number[];
  revealedHexes: number[];
  builtVessels: number[];
  recruitedCU: number[];
  builtCenters: number[];
  upgradedHabitats: number[];
  combatInitiated: number[];
  productionTotals: number[];
  productionTypes: (Resource | "labor")[][];
  productionAmounts: Record<Resource, number>[];
  technologyAdvances: TechnologyBranch[][];
  tradePartners: number[][];
  tradeCount: number[];
  receivedTradeValue: number[];
  givenTradeResources: number[];
  givenTradePartners: number[][];
  givenResearch: number[];
  laborTraded: number[];
  agreementsEstablished: number[][];
  marketCurrencyEarned: number;
  aurelianInfluenceTradePartners?: number[];
  aurelianMarketInfluenceSpent?: number;
  originalHabitatsCaptured: number[];
  prospectedHexes: string[];
  discountedHabitats: string[];
  brokeragePairs: string[];
  surveySales: number[];
  envoyHosts: number[];
  habitatDevelopmentHexes: string[][];
  militaryPresenceHexes: string[][];
  combatWinsAgainst: number[];
  defendedHabitats?: string[];
  directTradePartners: number[];
  directTradeCount: number;
  brokerageTransactions: number;
  frontierLegacyHexes: string[];
  publicReveals: number;
  aegisPlatformTransfers: number[];
  aegisForeignBeneficiaries: number[];
  aegisEconomicCenterBuilt?: boolean;
  wayfarerMigrationHexes: string[];
  wayfarerArkshipHexes?: string[];
  wayfarerRelocatedCenters: number;
  wayfarerProductionHexes: string[];
  wayfarerDeepScans: string[];
  salvoBombardTurns: number[];
  salvoBombardTargets: number[];
  salvoBombardKills: number;
  salvoBombardments: number;
  salvoGunForHireEvents: number;
  salvoGunForHireTargets: number[];
};

export type HiddenLegacyCard = {
  id: string;
  era: number;
  name: string;
  lp: number;
  condition: string;
  automatic: boolean;
};
export type HiddenLegacyState = {
  bankedPoints?: number;
  choices: string[];
  selected?: string;
  completed?: boolean;
  scored?: boolean;
};
export type PlayerController =
  | { kind: "human" }
  | { kind: "bot"; profileId: string };
export type UniversalClaim = {
  objectiveId: string;
  playerId: number;
  turn: number;
  lp: number;
};
export type GameResult = {
  gateSucceeded: boolean;
  winnerIds: number[];
  reason: string;
  finalizedTurn: number;
};

export type TutorialProgress = {
  id: "first-horizon";
  step: number;
  completed: boolean;
  dismissed: boolean;
  startedAt: string;
  completedAt?: string;
  seenPanels?: string[];
};

export type AcademyStageId = "foundation" | "signature" | "mastery";

export type AcademyProgress = {
  factionId: string;
  stage: number;
  completedStages: AcademyStageId[];
  completed: boolean;
  freePractice: boolean;
  dismissed: boolean;
  stageStartedTurn?: number;
  stageEvents?: string[];
  startedAt: string;
  completedAt?: string;
};

export type PlayerResolutionBrief = {
  turn: number;
  era: number;
  playerId: number;
  resourceDelta: Record<Resource, number>;
  laborDelta: number;
  lpDelta: number;
  habitatDelta: number;
  combatUnitDelta: number;
  tributeDelta: number;
  technology: TechnologyBranch[];
  events: string[];
};

export type TurnReplayMovement = {
  playerId: number;
  unitKind: "exploration" | "colony" | "carrier" | "civilian" | "mobileHabitat";
  unitIds: string[];
  fromHexId: string;
  toHexId: string;
  path: string[];
  outcome: "completed" | "blocked" | "destroyed";
};

export type TurnReplayHexChange = {
  hexId: string;
  ownerBefore?: number;
  ownerAfter?: number;
  tierBefore?: HabitatTier;
  tierAfter?: HabitatTier;
  centersAdded: CenterType[];
  combatUnitDelta: number;
  unitsAdded: string[];
};

export type TurnReplayFactionChange = {
  playerId: number;
  technologyAdvanced: TechnologyBranch[];
  gateContributions: number;
  combatUnitsPurchased: number;
  combatUnitDelta: number;
  habitatDelta: number;
  legacyDelta: number;
};

export type TurnReplay = {
  turn: number;
  era: number;
  resolvedAt: string;
  movements: TurnReplayMovement[];
  hexChanges: TurnReplayHexChange[];
  factions: TurnReplayFactionChange[];
  events: string[];
};

export type PlayerHistoryStats = {
  playerId: number;
  lp: number;
  resources: number;
  habitats: number;
  trades: number;
  tributes: number;
  military: number;
  technology: number;
};

export type GameHistoryPoint = {
  turn: number;
  era: number;
  gate: number;
  players: PlayerHistoryStats[];
};

export type CarrierState = {
  id: string;
  owner: number;
  type: CarrierType;
  hex: string;
  cu: number;
  lastHex?: string;
  readyTurn: number;
  movesRemaining: number;
  portalUsedTurn?: number;
};

export type MobileHabitatState = {
  id: string;
  owner: number;
  type: MobileHabitatType;
  hex: string;
  centers: CenterType[];
  caravanGuards: number;
  readyTurn: number;
  movesRemaining: number;
  deployed: boolean;
  constructionUsedTurn?: number;
};

export type BlockadeState = {
  id: string;
  owner: number;
  hex: string;
  active: boolean;
  /** Loaded Blockades are inactive and follow this military vessel. */
  carrierId?: string;
  readyTurn: number;
  originFaction: string;
};

export type HexState = {
  id: string;
  row: number;
  col: number;
  kind: HexKind;
  revealed: boolean;
  owner?: number;
  originalOwner?: number;
  tier?: HabitatTier;
  centers: CenterType[];
  combat: number;
  pendingCombat?: { amount: number; readyTurn: number }[];
  constructionUsedTurn?: number;
  prospected?: boolean;
  surveyedBy?: number[];
  anomalyResolvedBy?: number;
  anomalyReward?: string;
  captureRewardedTo?: number[];
  defenseGridOrigin?: string;
  arcologyOrigin?: string;
  enhancedCenterIndices?: number[];
  factoryOutputs?: Record<number, TradableResource>;
  portalDestinations?: string[];
};

export type PlayerState = {
  id: number;
  controller: PlayerController;
  faction: import("./factions/types").FactionId;
  rulesProfile?: import("./factions/types").CoreFactionRules;
  name: string;
  color: string;
  resources: Record<Resource, number>;
  laborCap: number;
  laborBonus: number;
  laborPenalty?: number;
  labor: number;
  lp: number;
  legacy: LegacyBreakdown;
  legacyMetrics: PlayerLegacyMetrics;
  civilizationClaims: string[];
  hiddenLegacy: Record<number, HiddenLegacyState>;
  tributes: number;
  eraTributes: number[];
  tech: Record<TechnologyBranch, number>;
  explorationVessels: ExplorationVesselState[];
  explorer: string;
  colonyShips: ColonyShipState[];
  /** Primary Colony Ship location retained for older saves and integrations. */
  colonyShip: string;
  modules: number;
  disabled: boolean;
  objectives: string[];
  techAdvancedTurn?: number;
  gloryAwards?: { turn: number; opponents: number[] };
  diplomacy: PlayerDiplomacy;
  privateSurveys: PrivateSurvey[];
  negotiationSurveyUsedTurn?: number;
  /** Retained for loading pre-0.17.1 saves. */
  surveyUsedTurn?: number;
  /** Retained for loading pre-0.17.1 saves. */
  forwardScanUsedTurn?: number;
  homeProductionChoice?: Resource;
  lastHomeProduction?: Resource;
  deepReconUsedTurn?: number;
};

export type GameState = {
  policyElection?: { era: number; choices: string[]; votes: { playerId: number; policyId: string; influence: number }[]; activePolicyId?: string; votingClosed?: boolean };
  policyUses?: Record<string, boolean>;
  scenarioId?: "first-horizon" | "faction-academy";
  tutorial?: TutorialProgress;
  academy?: AcademyProgress;
  resolutionBriefs?: PlayerResolutionBrief[];
  turnReplays?: TurnReplay[];
  secretHiddenScoring?: boolean;
  gateLedger?: { turn: number; era: number; playerId: number; cost: Partial<Record<Resource | "labor", number>> }[];
  schemaVersion: number;
  format: import("./rules/format").GameFormatId;
  mapId: import("./maps/types").MapId;
  contentPacks?: { id: string; version: string }[];
  enabledExpansions?: import("./entitlements").ExpansionId[];
  themeId: import("./themes/types").ThemeId;
  seed: number;
  players: PlayerState[];
  hexes: HexState[];
  active: number;
  turn: number;
  era: number;
  gate: number;
  selected: string;
  mode: CommandMode;
  moves: { explorer: number; colony: number };
  carriers: CarrierState[];
  mobileHabitats: MobileHabitatState[];
  blockades: BlockadeState[];
  bombardmentDamage: Record<string, number>;
  bombardmentsThisTurn: Record<number, number>;
  bombardmentMarks: { turn: number; salvoPlayerId: number; targetPlayerId: number; hexId: string; damage: number }[];
  civilianUnits: CivilianUnitState[];
  selectedCarrierIds: string[];
  log: string[];
  agreements: FormalAgreement[];
  proposals: DiplomacyProposal[];
  brokerageOffers: BrokerageOffer[];
  pendingLabor: { playerId: number; amount: number; effectiveTurn: number }[];
  stationingPermissions: { hostId: number; guestId: number; kind: "defensive" | "envoy" }[];
  pendingCenterLoss?: { hexId: string; playerId: number; removeCount: number };
  pendingCombatRedistributions: { hexId: string; playerId: number; total: number; carrierIds: string[]; allowStationed: boolean }[];
  universalClaims: UniversalClaim[];
  result?: GameResult;
  spectatorMode: boolean;
  history: GameHistoryPoint[];
  orderProtocol: OrderProtocol;
  botReports: import("./ai/types").BotDecisionReport[];
  botMemory: import("./ai/types").BotMemoryState[];
};
