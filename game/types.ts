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
export type HabitatTier = "Outpost" | "Colony" | "Metropolis";
export type CenterType = Resource | "labor" | "defense";
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
  | "xebec";
export type TradableResource = "material" | "currency" | "research";
export type TradeBundle = Record<TradableResource | "labor", number>;
export type AgreementType =
  | "trade"
  | "nonAggression"
  | "openBorders"
  | "research"
  | "defensive"
  | "alliance";
export type CivilianUnitType = "prospector" | "envoy" | "surveyor";
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
  soldTo: number[];
};

export type SecretOrder =
  | { id: string; kind: "hold"; label?: string }
  | { id: string; kind: "explorerMove"; destination: string }
  | { id: string; kind: "colonyMove"; destination: string }
  | {
      id: string;
      kind: "carrierMove";
      carrierIds: string[];
      destination: string;
    }
  | {
      id: string;
      kind: "civilianMove";
      unitId: string;
      destination: string;
    }
  | { id: string; kind: "forwardScan"; hexId: string }
  | {
      id: string;
      kind: "longRangeSurvey";
      unitId: string;
      hexId: string;
    }
  | { id: string; kind: "establish"; hexId: string }
  | { id: string; kind: "prospect"; unitId: string }
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
        | { type: "civilian"; civilian: CivilianUnitType };
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
  receivedTradeValue: number[];
  givenTradeResources: number[];
  givenResearch: number[];
  laborTraded: number[];
  agreementsEstablished: number[][];
  marketCurrencyEarned: number;
  originalHabitatsCaptured: number[];
  prospectedHexes: string[];
  discountedHabitats: string[];
  brokeragePairs: string[];
  surveySales: number[];
  envoyHosts: number[];
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
  readyTurn: number;
  movesRemaining: number;
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
};

export type PlayerState = {
  id: number;
  controller: PlayerController;
  faction: import("./factions/types").FactionId;
  name: string;
  color: string;
  resources: Record<Resource, number>;
  laborCap: number;
  laborBonus: number;
  labor: number;
  lp: number;
  legacy: LegacyBreakdown;
  legacyMetrics: PlayerLegacyMetrics;
  civilizationClaims: string[];
  hiddenLegacy: Record<number, HiddenLegacyState>;
  tributes: number;
  eraTributes: number[];
  tech: Record<TechnologyBranch, number>;
  explorer: string;
  colonyShip: string;
  modules: number;
  disabled: boolean;
  objectives: string[];
  techAdvancedTurn?: number;
  gloryAwards?: { turn: number; opponents: number[] };
  diplomacy: PlayerDiplomacy;
  privateSurveys: PrivateSurvey[];
  surveyUsedTurn?: number;
  forwardScanUsedTurn?: number;
};

export type GameState = {
  schemaVersion: number;
  mapId: import("./maps/types").MapId;
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
  civilianUnits: CivilianUnitState[];
  selectedCarrierIds: string[];
  log: string[];
  agreements: FormalAgreement[];
  proposals: DiplomacyProposal[];
  pendingLabor: { playerId: number; amount: number; effectiveTurn: number }[];
  pendingCenterLoss?: { hexId: string; playerId: number; removeCount: number };
  universalClaims: UniversalClaim[];
  result?: GameResult;
  spectatorMode: boolean;
  history: GameHistoryPoint[];
  orderProtocol: OrderProtocol;
  botReports: import("./ai/types").BotDecisionReport[];
  botMemory: import("./ai/types").BotMemoryState[];
};
