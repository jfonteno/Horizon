import { factionLibrary, type FactionId } from "../factions";
import type {
  GameResult,
  GameState,
  HiddenLegacyCard,
  LegacyCategory,
  PlayerLegacyMetrics,
  PlayerState,
} from "../types";
import { activeAgreements, hexDistance } from "./diplomacy";
import { carrierLibrary, totalCombatUnits } from "./fleet";
import { finalEra, gateTarget } from "./format";

// Hidden Legacy revision: tuned for four-Era play so early objectives reward strategic direction rather than requiring mature economies.
// Existing Hidden Legacy IDs are preserved for save compatibility.

export type LegacyObjective = {
  id: string;
  era: number;
  name: string;
  lp: number;
  condition: string;
  automatic: boolean;
};

export const universalLegacy: LegacyObjective[] = [
  {
    id: "beyond-frontier",
    era: 1,
    name: "Beyond the Frontier",
    lp: 3,
    condition: "Establish Habitats in 3 different non-starting hexes.",
    automatic: true,
  },
  {
    id: "interstellar-commerce",
    era: 1,
    name: "Interstellar Commerce",
    lp: 3,
    condition: "Complete successful trades with 3 different civilizations.",
    automatic: true,
  },
  {
    id: "renaissance",
    era: 1,
    name: "Renaissance",
    lp: 3,
    condition: "Possess Level II in 3 different Technology branches.",
    automatic: true,
  },
  { id: "first-foundations", era: 1, name: "First Foundations", lp: 3, condition: "Control 2 Habitats and 2 economic Centers.", automatic: true },
  { id: "prepared-civilization", era: 1, name: "Prepared Civilization", lp: 3, condition: "Control 6 CU and 2 military vessels.", automatic: true },
  { id: "first-conquest", era: 2, name: "First Conquest", lp: 3, condition: "Capture an enemy Habitat in combat.", automatic: true },
  { id: "hold-the-line", era: 2, name: "Hold the Line", lp: 3, condition: "Defend an owned Habitat against a hostile attack.", automatic: true },
  { id: "veteran-command", era: 3, name: "Veteran Command", lp: 4, condition: "Win combat against two different civilizations.", automatic: true },
  {
    id: "hub-civilization",
    era: 2,
    name: "Hub of Civilization",
    lp: 3,
    condition:
      "Control 3 Colonies or better producing different primary resources.",
    automatic: true,
  },
  {
    id: "diplomatic-network",
    era: 2,
    name: "Diplomatic Network",
    lp: 3,
    condition: "Maintain agreements with 3 different civilizations.",
    automatic: true,
  },
  { id: "developed-frontier", era: 2, name: "Developed Frontier", lp: 4, condition: "Control 3 Habitats, including a Colony, and 3 economic Centers.", automatic: true },
  { id: "technological-momentum", era: 2, name: "Technological Momentum", lp: 4, condition: "Have four branches at II and one at III.", automatic: true },
  { id: "secured-frontier", era: 2, name: "Secured Frontier", lp: 4, condition: "Control 3 Habitats, 8 CU, and military presence in 2 non-Homeworld hexes.", automatic: true },
  {
    id: "master-discipline",
    era: 3,
    name: "Master of a Discipline",
    lp: 4,
    condition: "Reach Level IV in any Technology branch.",
    automatic: true,
  },
  {
    id: "systemic-economy",
    era: 3,
    name: "Systemic Economy",
    lp: 3,
    condition:
      "Generate all 5 resource types in one Production Phase from your holdings.",
    automatic: true,
  },
  {
    id: "coalition",
    era: 3,
    name: "Coalition",
    lp: 4,
    condition:
      "Participate in a formal Alliance involving at least 3 civilizations.",
    automatic: true,
  },
  { id: "great-works", era: 3, name: "Great Works", lp: 4, condition: "During Era III complete 3 Habitat developments across 2 Habitats, including a Center and upgrade.", automatic: true },
  { id: "projection-power", era: 3, name: "Projection of Power", lp: 4, condition: "Control 10 CU with military presence in 3 non-Homeworld hexes and one force 3 hexes from home.", automatic: true },
  {
    id: "architect-horizon",
    era: 4,
    name: "Architect of the Horizon",
    lp: 4,
    condition: "Contribute at least 1 Gate Tribute in every Era.",
    automatic: true,
  },
  {
    id: "metropolis-stars",
    era: 4,
    name: "Metropolis of the Stars",
    lp: 3,
    condition: "Control 3 Metropolises or Arcologies simultaneously.",
    automatic: true,
  },
  {
    id: "nexus-humanity",
    era: 4,
    name: "Nexus of Humanity",
    lp: 3,
    condition:
      "Maintain 3 agreements, control 4 Habitats, and possess Level III in 3 branches.",
    automatic: true,
  },
  { id: "civilization-scale", era: 4, name: "Civilization at Scale", lp: 5, condition: "Control 4 Habitats, 8 CU, 3 agreements, and 3 branches at III.", automatic: true },
  { id: "system-power", era: 4, name: "System Power", lp: 5, condition: "Control 12 CU, 16 military capacity, and a Level IV Technology.", automatic: true },
  { id: "system-architect", era: 5, name: "System Architect", lp: 4, condition: "During Era V complete 3 Habitat developments across 2 Habitats, including an upgrade.", automatic: true },
  { id: "strategic-supremacy", era: 5, name: "Strategic Supremacy", lp: 4, condition: "Control 14 CU, 18 military capacity, and presence in 3 non-Homeworld hexes.", automatic: true },
  { id: "interstellar-institution", era: 5, name: "Interstellar Institution", lp: 5, condition: "Maintain 4 agreements involving 3 civilizations and store 3 Influence.", automatic: true },
  { id: "complete-civilization-v", era: 5, name: "Complete Civilization", lp: 5, condition: "Control 4 Habitats, 4 economic Center types, 4 branches at III, and 10 CU.", automatic: true },
  { id: "legacy-power", era: 5, name: "Legacy Power", lp: 5, condition: "During Era V contribute or build military, advance Technology, develop a Habitat, and trade.", automatic: true },
];

const H = (
  id: string,
  era: number,
  name: string,
  lp: number,
  condition: string,
  automatic = true,
): HiddenLegacyCard => ({ id, era, name, lp, condition, automatic });
export const hiddenLegacyDeck: HiddenLegacyCard[] = [
  H(
    "h1-frontier",
    1,
    "Frontier Spirit",
    4,
    "Establish 1 new Habitat during this Era.",
  ),
  H(
    "h1-first",
    1,
    "First Among Equals",
    4,
    "End the Era controlling at least 2 Habitats and at least 1 economic Center.",
  ),
  H(
    "h1-specialist",
    1,
    "Specialist",
    4,
    "Advance any Technology branch once and end the Era with at least 2 Research stored.",
  ),
  H(
    "h1-renaissance",
    1,
    "Renaissance Civilization",
    4,
    "Complete at least 2 of these during the Era: advance Technology, establish a Habitat, construct a Center.",
  ),
  H(
    "h1-merchant",
    1,
    "Merchant Prince",
    4,
    "Complete successful trades with 2 different civilizations.",
  ),
  H(
    "h1-investment",
    1,
    "Foreign Investment",
    4,
    "Receive 3 resource units through trade; Labor counts as 3.",
  ),
  H(
    "h1-mobilization",
    1,
    "Industrial Mobilization",
    4,
    "Complete at least 2 of these during the Era: construct a military vessel, recruit 2 CU, construct a Center or Habitat.",
  ),
  H(
    "h1-peace",
    1,
    "Peaceful Prosperity",
    5,
    "Complete at least 2 of these during the Era without initiating combat: establish a Habitat, advance Technology, construct a Center.",
  ),
  H(
    "h1-pioneer",
    1,
    "Horizon Pioneer",
    5,
    "Purchase an Era I Gate Tribute and either establish a Habitat or advance Technology.",
  ),
  H("h1-surveyor", 1, "Surveyor", 4, "Reveal 3 unexplored hexes."),

  H(
    "h2-commerce",
    2,
    "Web of Commerce",
    4,
    "Trade with 3 different civilizations during this Era.",
  ),
  H(
    "h2-labor",
    2,
    "Labor Market",
    5,
    "Buy or sell permanent Labor Capacity, or end the Era with Labor Capacity 5 or higher.",
  ),
  H(
    "h2-builder",
    2,
    "Builder of Worlds",
    4,
    "Complete 2 Habitat-development actions this Era: upgrades and/or Center construction.",
  ),
  H(
    "h2-colonial",
    2,
    "Colonial Power",
    5,
    "Control at least 3 Habitats including at least 1 Colony or Metropolis.",
  ),
  H(
    "h2-arms",
    2,
    "Arms Dealer",
    5,
    "Control at least 6 CU and provide at least 2 Material, Currency, or Research to other civilizations this Era.",
  ),
  H(
    "h2-science",
    2,
    "Patron of Science",
    4,
    "Transfer at least 2 Research to other civilizations during this Era.",
  ),
  H(
    "h2-diplomatic",
    2,
    "Diplomatic Offensive",
    5,
    "Establish agreements with 2 different civilizations during this Era.",
  ),
  H(
    "h2-balanced",
    2,
    "Balanced Development",
    4,
    "End the Era at Level II or higher in at least 3 Technology branches.",
  ),
  H(
    "h2-guardian",
    2,
    "Guardian",
    5,
    "End the Era controlling at least 8 CU without initiating combat during the Era.",
  ),
  H(
    "h2-burden",
    2,
    "Shared Burden",
    5,
    "Purchase an Era II Gate Tribute and provide at least 2 Material, Currency, or Research to other civilizations this Era.",
  ),

  H(
    "h3-tech",
    3,
    "Technological Powerhouse",
    5,
    "Advance a Technology branch to Level IV during this Era and end with at least 2 Research.",
  ),
  H(
    "h3-builder",
    3,
    "Master Builder",
    5,
    "Complete 3 developments across 2 Habitats during this Era, including a Center and an upgrade.",
  ),
  H(
    "h3-engine",
    3,
    "Economic Engine",
    5,
    "Produce at least 9 Currency, Material, Research, and Influence combined in one Production Phase.",
  ),
  H("h3-mobilization", 3, "Mobilization", 5, "Recruit 6 Combat Units during this Era and control at least 8 CU."),
  H("h3-conqueror", 3, "Conqueror", 6, "Capture at least 2 enemy Habitats during this Era."),
  H(
    "h3-peace",
    3,
    "Peace Through Strength",
    5,
    "Control at least 12 CU without initiating combat during this Era.",
  ),
  H(
    "h3-broker",
    3,
    "Power Broker",
    5,
    "Complete 4 trades with at least 3 civilizations during this Era and maintain at least 3 agreements.",
  ),
  H(
    "h3-supplier",
    3,
    "System Supplier",
    5,
    "Provide at least 6 Material, Research, or Currency to at least 3 other civilizations during this Era.",
  ),
  H(
    "h3-architect",
    3,
    "Architect",
    5,
    "Complete at least 4 construction or Habitat-development actions across at least 3 categories during this Era.",
  ),
  H(
    "h3-leadership",
    3,
    "Burden of Leadership",
    5,
    "Purchase an Era III Gate Tribute, tie or lead in total personal Tributes, and provide at least 2 resources through trade this Era.",
  ),

  H(
    "h4-science",
    4,
    "Crown of Science",
    6,
    "End the game with 2 Technology branches at Level IV.",
  ),
  H(
    "h4-great",
    4,
    "Great Civilization",
    6,
    "Control at least 5 Habitats including at least 2 Metropolises.",
  ),
  H("h4-arsenal", 4, "Arsenal of Humanity", 5, "Control at least 12 Combat Units."),
  H(
    "h4-conquest",
    4,
    "Final Conquest",
    6,
    "Capture a Metropolis during Era IV.",
  ),
  H(
    "h4-partner",
    4,
    "Indispensable Partner",
    6,
    "Maintain agreements with all but at most 2 other civilizations.",
  ),
  H(
    "h4-economy",
    4,
    "Economic Hegemony",
    6,
    "Hold at least 10 Currency, Material, and Research combined.",
  ),
  H(
    "h4-expansion",
    4,
    "Last Great Expansion",
    5,
    "Establish or capture at least 2 Habitats during Era IV.",
  ),
  H(
    "h4-compromise",
    4,
    "The Great Compromise",
    6,
    "Trade with at least 3 civilizations during Era IV and purchase a Gate Tribute.",
  ),
  H(
    "h4-savior",
    4,
    "Savior of the Horizon",
    6,
    "Purchase at least 2 Gate Tributes during Era IV.",
  ),
  H(
    "h4-complete",
    4,
    "Complete Civilization",
    6,
    "Reach Level III in at least 4 Technology branches, control at least 3 Habitats, and maintain at least 1 agreement.",
  ),
  H("h5-great", 5, "Great Works", 6, "Complete 4 Habitat developments across 3 Habitats, including a Center and upgrade."),
  H("h5-command", 5, "Command of the System", 6, "Win 2 combats against 2 civilizations and retain all starting Era V Habitats."),
  H("h5-commerce", 5, "Commercial Commonwealth", 6, "Complete 5 trades involving 3 civilizations, giving and receiving 5 resources."),
  H("h5-science", 5, "Mature Science", 6, "Advance 2 different branches and end with 3 Research."),
  H("h5-federal", 5, "Federal Network", 6, "Establish 2 agreements and end with 4 active agreements involving 3 civilizations."),
  H("h5-reserve", 5, "Strategic Reserve", 6, "End with 10 Currency, Material, and Research combined, 10 CU, and 2 Influence."),
  H("h5-expansion", 5, "Grand Expansion", 6, "Establish or capture 2 Habitats and develop Habitats across 3 hexes."),
  H("h5-steward", 5, "Horizon Steward", 6, "Contribute or complete an additional advance or development, provide 4 resources, and store 2 Influence."),
  H("h5-peace", 5, "Arsenal of Peace", 6, "End with 14 CU, initiate no combat, and establish an agreement."),
  H("h5-motion", 5, "Civilization in Motion", 6, "Complete 4 different development, military, Technology, or diplomatic action categories."),
];

export const civilizationLegacy: Record<
  FactionId,
  {
    id: string;
    name: string;
    lp: number;
    condition: string;
    automatic: boolean;
  }[]
> = {
  varkesh: [
    {
      id: "v-mobilized",
      name: "Mobilized Society",
      lp: 3,
      condition: "Control 10 CU.",
      automatic: true,
    },
    {
      id: "v-fleet",
      name: "Fleet Doctrine",
      lp: 4,
      condition: "Control 20 carrier Capacity.",
      automatic: true,
    },
    {
      id: "v-conquest",
      name: "Conquering Power",
      lp: 5,
      condition: "Control 2 rival Homeworld Habitats.",
      automatic: true,
    },
    { id: "v-campaign", name: "Campaign Supremacy", lp: 6, condition: "Win combats against 3 civilizations and control a captured Habitat.", automatic: true },
    { id: "v-dominion", name: "Dominion of the Reach", lp: 7, condition: "Win against all rivals, control 3 foreign-founded Habitats, and end with 14 CU.", automatic: true },
  ],
  helix: [
    {
      id: "h-network",
      name: "Research Network",
      lp: 3,
      condition: "Control 3 Research Centers.",
      automatic: true,
    },
    {
      id: "h-breadth",
      name: "Technological Breadth",
      lp: 4,
      condition: "Reach Level III in 3 branches.",
      automatic: true,
    },
    {
      id: "h-export",
      name: "Knowledge Exporter",
      lp: 5,
      condition: "Export Technology to 2 civilizations.",
      automatic: true,
    },
    { id: "h-leadership", name: "Scientific Leadership", lp: 6, condition: "Have 2 branches at IV and 4 Research Centers.", automatic: true },
    { id: "h-synthesis", name: "Grand Synthesis", lp: 7, condition: "Have all branches at III, 3 at IV, and export to every rival.", automatic: true },
  ],
  foundry: [
    {
      id: "f-engine",
      name: "Material Engine",
      lp: 3,
      condition: "Produce 4 Material in one Production Phase.",
      automatic: true,
    },
    {
      id: "f-prospect",
      name: "Prospector Network",
      lp: 4,
      condition: "Prospect 4 different hexes.",
      automatic: true,
    },
    {
      id: "f-industry",
      name: "Industrial Base",
      lp: 5,
      condition: "Control 5 economic Centers across 3 Habitats.",
      automatic: true,
    },
    { id: "f-worldworks", name: "Worldworks", lp: 6, condition: "Complete 10 Habitat-development actions across 4 Habitats.", automatic: true },
    { id: "f-civilization", name: "Industrial Civilization", lp: 7, condition: "Control 5 Habitats, 8 economic Centers, 2 Metropolises, and 3 Material Centers.", automatic: true },
  ],
  aurelians: [
    {
      id: "a-service",
      name: "Foreign Service",
      lp: 3,
      condition: "Host Envoys with 2 civilizations.",
      automatic: true,
    },
    {
      id: "a-web",
      name: "Diplomatic Web",
      lp: 4,
      condition: "Maintain agreements with 3 civilizations.",
      automatic: true,
    },
    {
      id: "a-influence",
      name: "Influence Network",
      lp: 5,
      condition: "Gain 5 bonus Influence from diplomacy.",
      automatic: true,
    },
    { id: "a-concert", name: "Concert of Worlds", lp: 6, condition: "Maintain agreements with up to 4 other civilizations (all rivals in a 4-player game) across 3 types and store 4 Influence.", automatic: true },
    { id: "a-consensus", name: "Galactic Consensus", lp: 7, condition: "Establish with every rival, end with 5 agreements, and gain 10 faction Influence.", automatic: true },
    { id: "a-broker", name: "Influence Broker", lp: 4, condition: "Trade Influence to 3 different civilizations through accepted direct trades.", automatic: true },
    { id: "a-exchange", name: "Political Exchange", lp: 5, condition: "Spend 8 Influence through System Market exchanges.", automatic: true },
  ],
  meridian: [
    {
      id: "m-broker",
      name: "Broker",
      lp: 3,
      condition: "Broker 3 civilization pairs.",
      automatic: true,
    },
    {
      id: "m-network",
      name: "Commercial Network",
      lp: 4,
      condition: "Maintain Trade Agreements or Alliances with 3 civilizations.",
      automatic: true,
    },
    {
      id: "m-hegemony",
      name: "Trade Hegemony",
      lp: 5,
      condition: "Gain 8 Currency from Brokerage and Market sales.",
      automatic: true,
    },
    { id: "m-exchange", name: "System Exchange", lp: 6, condition: "Trade with every rival and broker 6 trades across 4 pairs.", automatic: true },
    { id: "m-commercial", name: "Commercial Hegemony", lp: 7, condition: "Gain 15 Market or Brokerage Currency, maintain 4 trade relations, and complete 10 direct trades.", automatic: true },
  ],
  farbound: [
    {
      id: "b-survey",
      name: "Survey Network",
      lp: 3,
      condition: "Survey 6 unrevealed hexes.",
      automatic: true,
    },
    {
      id: "b-frontier",
      name: "Frontier Civilization",
      lp: 4,
      condition: "Establish 3 discounted Habitats.",
      automatic: true,
    },
    {
      id: "b-information",
      name: "Information Economy",
      lp: 5,
      condition:
        "Sell surveys to 3 civilizations and control 4 surveyed Habitats.",
      automatic: true,
    },
    { id: "b-pathfinder", name: "Pathfinder Civilization", lp: 6, condition: "Survey 10 hexes, publicly reveal 8, and establish 4 surveyed Habitats.", automatic: true },
    { id: "b-beyond", name: "Beyond the Frontier", lp: 7, condition: "Survey 12 hexes, control 5 surveyed Habitats, trigger Frontier Legacy twice, and sell to 3 civilizations.", automatic: true },
  ],
  spires: [
    { id: "sp-urban", name: "Urban Core", lp: 3, condition: "Control 2 Colonies or Arcologies with 4 economic Centers among them.", automatic: true },
    { id: "sp-fortified", name: "Fortified Cities", lp: 4, condition: "Control 2 Habitats with active Spires Defense Grids, including an Arcology.", automatic: true },
    { id: "sp-arcology", name: "Arcology Civilization", lp: 5, condition: "Control a Spires Arcology and 6 economic Centers across no more than 3 Habitats.", automatic: true },
    { id: "sp-vertical", name: "Vertical Civilization", lp: 6, condition: "Control 2 Spires Arcologies with 8 economic Centers among your Habitats.", automatic: true },
    { id: "sp-horizon", name: "Cities Without Horizon", lp: 7, condition: "Control 2 Spires Arcologies, 10 economic Centers, produce 12 resources at once, and control no more than 4 Habitats.", automatic: true },
  ],
  aegis: [
    { id: "ae-fortress", name: "Fortress Civilization", lp: 3, condition: "Protect 3 Habitats, including a Colony or Metropolis.", automatic: true },
    { id: "ae-arms", name: "Arms for Peace", lp: 4, condition: "Transfer defensive platforms to 2 civilizations.", automatic: true },
    { id: "ae-provider", name: "Security Provider", lp: 5, condition: "Transfer 4 platforms involving 3 civilizations.", automatic: true },
    { id: "ae-shield", name: "Shield Across the Reach", lp: 6, condition: "Provide assets to 3 civilizations and deploy 4 defenses away from home.", automatic: true },
    { id: "ae-architecture", name: "Security Architecture", lp: 7, condition: "Maintain 6 defenses, 3 agreements, and foreign protection across the Reach.", automatic: true },
  ],
  wayfarers: [
    { id: "wa-voyage", name: "Arkship Voyage", lp: 3, condition: "Migrate an Arkship through 3 distinct hexes.", automatic: true },
    { id: "wa-caravan", name: "The Caravan", lp: 3, condition: "Control 2 mobile Habitats.", automatic: true },
    { id: "wa-wandering", name: "Wandering Civilization", lp: 4, condition: "Produce from mobile Habitats in 3 different hexes.", automatic: true },
    { id: "wa-exodus", name: "The Great Exodus", lp: 5, condition: "Relocate 3 Centers through Migration.", automatic: true },
    { id: "wa-advanced", name: "Civilization in Motion", lp: 6, condition: "Migrate through 6 hexes, control 4 Habitats, and support them with 3 military vessels.", automatic: true },
    { id: "wa-reach", name: "A People Beyond Reach", lp: 7, condition: "Control 5 Habitats, relocate 3 Centers, scan 8 hexes, and protect 3 mobile Habitats.", automatic: true },
  ],
  salvo: [
    { id: "sa-mission", name: "Fire Mission", lp: 3, condition: "Bombard in 3 different Turns.", automatic: true },
    { id: "sa-hire", name: "Gun for Hire", lp: 4, condition: "Support three third-party victories against 2 civilizations.", automatic: true },
    { id: "sa-superiority", name: "Fire Superiority", lp: 5, condition: "Destroy 6 CU by Bombardment across 2 civilizations.", automatic: true },
    { id: "sa-network", name: "Artillery Network", lp: 6, condition: "Bombard in 6 Turns, target 3 civilizations, and destroy 6 CU.", automatic: true },
    { id: "sa-dominion", name: "Dominion by Fire", lp: 7, condition: "Bombard 10 times, affect 4 civilizations, destroy 10 CU, and retain 3 artillery assets.", automatic: true },
  ],
  guilds: [
    { id: "gu-specialized", name: "Specialized Economy", lp: 3, condition: "Control 3 different economic Center types.", automatic: true },
    { id: "gu-masterworks", name: "Masterworks", lp: 4, condition: "Control 2 Enhanced Centers.", automatic: true },
    { id: "gu-engine", name: "Engine of Prosperity", lp: 5, condition: "Produce 10 resources at once, including 4 from Enhanced Centers.", automatic: true },
    { id: "gu-advanced", name: "Advanced Masterworks", lp: 6, condition: "Control 6 Enhanced Centers representing 4 economic types.", automatic: true },
    { id: "gu-masters", name: "Civilization of Masters", lp: 7, condition: "Control 8 Enhanced Centers across 4 Habitats and produce 14 resources at once.", automatic: true },
  ],
};

export function civilizationObjectives(player: PlayerState) {
  const inherited = civilizationLegacy[player.faction];
  if (inherited) return inherited;
  const definition = factionLibrary[player.faction];
  return (definition?.objectives || []).map((condition, index) => ({
    id: `pack-${player.faction}-${index + 1}`,
    name: condition.split(":")[0] || `Civilization Objective ${index + 1}`,
    condition,
    lp: index + 3,
    automatic: false,
  }));
}

export function emptyLegacyMetrics(): PlayerLegacyMetrics {
  return {
    habitatsEstablished: [0, 0, 0, 0, 0],
    habitatsCaptured: [0, 0, 0, 0, 0],
    metropolisCaptured: [0, 0, 0, 0, 0],
    revealedHexes: [0, 0, 0, 0, 0],
    builtVessels: [0, 0, 0, 0, 0],
    recruitedCU: [0, 0, 0, 0, 0],
    builtCenters: [0, 0, 0, 0, 0],
    upgradedHabitats: [0, 0, 0, 0, 0],
    combatInitiated: [0, 0, 0, 0, 0],
    productionTotals: [0, 0, 0, 0, 0],
    productionTypes: [[], [], [], [], []],
    productionAmounts: [
      { material: 0, currency: 0, research: 0, influence: 0 },
      { material: 0, currency: 0, research: 0, influence: 0 },
      { material: 0, currency: 0, research: 0, influence: 0 },
      { material: 0, currency: 0, research: 0, influence: 0 },
      { material: 0, currency: 0, research: 0, influence: 0 },
    ],
    technologyAdvances: [[], [], [], [], []],
    tradePartners: [[], [], [], [], []],
    tradeCount: [0, 0, 0, 0, 0],
    receivedTradeValue: [0, 0, 0, 0, 0],
    givenTradeResources: [0, 0, 0, 0, 0],
    givenTradePartners: [[], [], [], [], []],
    givenResearch: [0, 0, 0, 0, 0],
    laborTraded: [0, 0, 0, 0, 0],
    agreementsEstablished: [[], [], [], [], []],
    marketCurrencyEarned: 0,
    aurelianInfluenceTradePartners: [],
    aurelianMarketInfluenceSpent: 0,
    originalHabitatsCaptured: [],
    prospectedHexes: [],
    discountedHabitats: [],
    brokeragePairs: [],
    surveySales: [],
    envoyHosts: [],
    habitatDevelopmentHexes: [[], [], [], [], []],
    militaryPresenceHexes: [[], [], [], [], []],
    combatWinsAgainst: [],
    directTradePartners: [],
    directTradeCount: 0,
    brokerageTransactions: 0,
    frontierLegacyHexes: [],
    publicReveals: 0,
    aegisPlatformTransfers: [],
    aegisForeignBeneficiaries: [],
    aegisEconomicCenterBuilt: false,
    wayfarerMigrationHexes: [],
    wayfarerArkshipHexes: [],
    wayfarerRelocatedCenters: 0,
    wayfarerProductionHexes: [],
    wayfarerDeepScans: [],
    salvoBombardTurns: [],
    salvoBombardTargets: [],
    salvoBombardKills: 0,
    salvoBombardments: 0,
    salvoGunForHireEvents: 0,
    salvoGunForHireTargets: [],
  };
}
export function emptyLegacyBreakdown() {
  return { universal: 0, civilization: 0, hidden: 0, faction: 0, manual: 0 };
}
const unique = (values: number[]) => new Set(values).size;
const habitats = (game: GameState, id: number) =>
  game.hexes.filter((h) => h.owner === id && h.tier);
const agreementPartners = (game: GameState, id: number, types?: string[]) =>
  new Set(
    activeAgreements(game)
      .filter(
        (a) => a.parties.includes(id) && (!types || types.includes(a.type)),
      )
      .map((a) => (a.parties[0] === id ? a.parties[1] : a.parties[0])),
  ).size;
const techAt = (p: PlayerState, level: number) =>
  Object.values(p.tech).filter((value) => value >= level).length;
const economicCenters = (game: GameState, id: number) => habitats(game, id).reduce((sum, hex) => sum + hex.centers.filter((center) => center !== "defense").length, 0);
const carrierCapacity = (game: GameState, id: number) => game.carriers.filter((carrier) => carrier.owner === id).reduce((sum, carrier) => sum + carrierLibrary[carrier.type].capacity, 0);
const militaryHexes = (game: GameState, id: number) => new Set([
  ...game.carriers.filter((carrier) => carrier.owner === id && carrier.cu > 0).map((carrier) => carrier.hex),
  ...game.hexes.filter((hex) => hex.owner === id && hex.combat > 0).map((hex) => hex.id),
]);
export function awardLegacy(
  game: GameState,
  playerId: number,
  category: LegacyCategory,
  lp: number,
  label: string,
) {
  const p = game.players[playerId];
  p.lp += lp;
  p.legacy[category] += lp;
  game.log.unshift(`${p.name} gained ${lp} LP from ${label}.`);
}

function universalSatisfied(game: GameState, p: PlayerState, id: string) {
  const hs = habitats(game, p.id),
    m = p.legacyMetrics;
  switch (id) {
    case "beyond-frontier":
      return m.habitatsEstablished[0] >= 3;
    case "interstellar-commerce":
      return unique(m.tradePartners[0]) >= 3;
    case "renaissance":
      return techAt(p, 2) >= 3;
    case "first-foundations":
      return hs.length >= 2 && economicCenters(game, p.id) >= 2;
    case "prepared-civilization":
      return totalCombatUnits(game, p.id) >= 6 && game.carriers.filter((carrier) => carrier.owner === p.id).length >= 2;
    case "first-conquest": return m.habitatsCaptured.reduce((sum, count) => sum + count, 0) >= 1;
    case "hold-the-line": return (m.defendedHabitats || []).length >= 1;
    case "veteran-command": return m.combatWinsAgainst.length >= 2;
    case "hub-civilization":
      return (
        new Set(
          hs
            .filter(
              (h) =>
                h.tier !== "Outpost" &&
                [
                  "material",
                  "currency",
                  "research",
                  "influence",
                  "labor",
                ].includes(h.kind),
            )
            .map((h) => h.kind),
        ).size >= 3
      );
    case "diplomatic-network":
      return agreementPartners(game, p.id) >= 3;
    case "developed-frontier":
      return hs.length >= 3 && hs.some((hex) => hex.tier !== "Outpost") && economicCenters(game, p.id) >= 3;
    case "technological-momentum":
      return techAt(p, 2) >= 4 && techAt(p, 3) >= 1;
    case "secured-frontier": {
      const presence = [...militaryHexes(game, p.id)].filter((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "home").length;
      return hs.length >= 3 && totalCombatUnits(game, p.id) >= 8 && presence >= 2;
    }
    case "master-discipline":
      return techAt(p, 4) >= 1;
    case "systemic-economy":
      return new Set(m.productionTypes[2]).size >= 5;
    case "coalition":
      return agreementPartners(game, p.id, ["alliance"]) >= 2;
    case "great-works":
      return m.builtCenters[2] >= 1 && m.upgradedHabitats[2] >= 1 && m.builtCenters[2] + m.upgradedHabitats[2] >= 3 && new Set(m.habitatDevelopmentHexes[2]).size >= 2;
    case "projection-power": {
      const home = game.hexes.find((hex) => hex.kind === "home" && hex.originalOwner === p.id)?.id || "";
      const presence = [...militaryHexes(game, p.id)].filter((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "home");
      return totalCombatUnits(game, p.id) >= 10 && presence.length >= 3 && presence.some((id) => home && hexDistance(id, home) >= 3);
    }
    case "architect-horizon":
      return p.eraTributes.every((v) => v >= 1);
    case "metropolis-stars":
      return hs.filter((h) => h.tier === "Metropolis" || h.tier === "Arcology").length >= 3;
    case "nexus-humanity":
      return (
        agreementPartners(game, p.id) >= 3 &&
        hs.length >= 4 &&
        techAt(p, 3) >= 3
      );
    case "civilization-scale":
      return hs.length >= 4 && totalCombatUnits(game, p.id) >= 8 && agreementPartners(game, p.id) >= 3 && techAt(p, 3) >= 3;
    case "system-power":
      return totalCombatUnits(game, p.id) >= 12 && carrierCapacity(game, p.id) >= 16 && techAt(p, 4) >= 1;
    case "system-architect":
      return m.upgradedHabitats[4] >= 1 && m.builtCenters[4] + m.upgradedHabitats[4] >= 3 && new Set(m.habitatDevelopmentHexes[4]).size >= 2;
    case "strategic-supremacy":
      return totalCombatUnits(game, p.id) >= 14 && carrierCapacity(game, p.id) >= 18 && [...militaryHexes(game, p.id)].filter((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "home").length >= 3;
    case "interstellar-institution":
      return activeAgreements(game).filter((agreement) => agreement.parties.includes(p.id)).length >= 4 && agreementPartners(game, p.id) >= 3 && p.resources.influence >= 3;
    case "complete-civilization-v":
      return hs.length >= 4 && new Set(hs.flatMap((hex) => hex.centers.filter((center) => center !== "defense"))).size >= 4 && techAt(p, 3) >= 4 && totalCombatUnits(game, p.id) >= 10;
    case "legacy-power": {
      const military = m.builtVessels[4] > 0 || m.recruitedCU[4] > 0;
      return (p.eraTributes[4] > 0 || (game.gate >= gateTarget(game) && military)) && m.technologyAdvances[4].length > 0 && m.builtCenters[4] + m.upgradedHabitats[4] > 0 && m.tradePartners[4].length > 0;
    }
    default:
      return false;
  }
}

function civilizationSatisfied(game: GameState, p: PlayerState, id: string) {
  const hs = habitats(game, p.id),
    m = p.legacyMetrics;
  const economic = (hex: typeof hs[number]) => hex.centers.filter((center) => center !== "defense" && center !== "factory").length;
  const enhanced = hs.flatMap((hex) => (hex.enhancedCenterIndices || []).map((index) => ({ hex, center: hex.centers[index] }))).filter((entry) => entry.center && !["defense", "labor", "factory"].includes(entry.center));
  const mobiles = game.mobileHabitats.filter((mobile) => mobile.owner === p.id);
  const protectedHabitats = hs.filter((hex) => hex.centers.includes("defense") || game.blockades.some((blockade) => blockade.owner === p.id && blockade.active && blockade.hex === hex.id));
  switch (id) {
    case "v-mobilized":
      return totalCombatUnits(game, p.id) >= 10;
    case "v-fleet":
      return (
        game.carriers
          .filter((c) => c.owner === p.id)
          .reduce((s, c) => s + carrierLibrary[c.type].capacity, 0) >= 20
      );
    case "v-conquest":
      return (
        hs.filter(
          (h) => h.originalOwner !== undefined && h.originalOwner !== p.id,
        ).length >= 2
      );
    case "v-campaign":
      return m.combatWinsAgainst.length >= 3 && hs.some((h) => h.originalOwner !== undefined && h.originalOwner !== p.id);
    case "v-dominion":
      return m.combatWinsAgainst.length >= Math.min(4, game.players.length - 1) && hs.filter((h) => h.originalOwner !== undefined && h.originalOwner !== p.id).length >= 3 && totalCombatUnits(game, p.id) >= 14;
    case "h-network":
      return (
        hs.reduce(
          (s, h) => s + h.centers.filter((c) => c === "research").length,
          0,
        ) >= 3
      );
    case "h-breadth":
      return techAt(p, 3) >= 3;
    case "h-export":
      return p.diplomacy.technologyExportPartners.length >= 2;
    case "h-leadership":
      return techAt(p, 4) >= 2 && hs.reduce((sum, h) => sum + h.centers.filter((c) => c === "research").length, 0) >= 4;
    case "h-synthesis":
      return techAt(p, 3) >= 5 && techAt(p, 4) >= 3 && p.diplomacy.technologyExportPartners.length >= Math.min(3, game.players.length - 1);
    case "f-engine":
      return m.productionAmounts.some((amounts) => amounts.material >= 4);
    case "f-prospect":
      return m.prospectedHexes.length >= 4;
    case "f-industry":
      return (
        hs.filter((h) => h.centers.some((c) => c !== "defense")).length >= 3 &&
        hs.reduce(
          (s, h) => s + h.centers.filter((c) => c !== "defense").length,
          0,
        ) >= 5
      );
    case "f-worldworks":
      return m.habitatDevelopmentHexes.flat().length >= 10 && new Set(m.habitatDevelopmentHexes.flat()).size >= 4;
    case "f-civilization":
      return hs.length >= 5 && economicCenters(game, p.id) >= 8 && hs.filter((h) => h.tier === "Metropolis").length >= 2 && hs.reduce((sum, h) => sum + h.centers.filter((c) => c === "material").length, 0) >= 3;
    case "a-web":
      return agreementPartners(game, p.id) >= 3;
    case "a-service":
      return (
        new Set(
          game.civilianUnits
            .filter((unit) => unit.owner === p.id && unit.type === "envoy")
            .map((unit) => game.hexes.find((hex) => hex.id === unit.hex)?.owner)
            .filter(
              (owner): owner is number =>
                owner !== undefined && owner !== p.id,
            ),
        ).size >= 2
      );
    case "a-influence":
      return (p.diplomacy.bonusInfluenceGained || 0) >= 5;
    case "a-concert": {
      const agreements = activeAgreements(game).filter((agreement) => agreement.parties.includes(p.id));
      return agreementPartners(game, p.id) >= Math.min(4, game.players.length - 1) && new Set(agreements.map((agreement) => agreement.type)).size >= 3 && p.resources.influence >= 4;
    }
    case "a-broker": return new Set(m.aurelianInfluenceTradePartners || []).size >= 3;
    case "a-exchange": return (m.aurelianMarketInfluenceSpent || 0) >= 8;
    case "a-consensus":
      return p.diplomacy.firstAgreementPartners.length >= game.players.length - 1 && activeAgreements(game).filter((agreement) => agreement.parties.includes(p.id)).length >= 5 && (p.diplomacy.bonusInfluenceGained || 0) >= 10;
    case "m-network":
      return agreementPartners(game, p.id, ["trade", "alliance"]) >= 3;
    case "m-broker":
      return (
        new Set(m.brokeragePairs.map((pair) => pair.split(":").pop())).size >= 3
      );
    case "m-hegemony":
      return m.marketCurrencyEarned >= 8;
    case "m-exchange":
      return m.directTradePartners.length >= game.players.length - 1 && m.brokerageTransactions >= 6 && new Set(m.brokeragePairs.map((pair) => pair.split(":").pop())).size >= Math.min(4, ((game.players.length - 1) * (game.players.length - 2)) / 2);
    case "m-commercial":
      return m.marketCurrencyEarned >= 15 && agreementPartners(game, p.id, ["trade", "alliance"]) >= Math.min(4, game.players.length - 1) && m.directTradeCount >= 10;
    case "b-survey":
      return p.privateSurveys.length >= 6;
    case "b-frontier":
      return m.discountedHabitats.length >= 3;
    case "b-information":
      return (
        new Set(m.surveySales).size >= 3 &&
        hs.filter((h) => h.surveyedBy?.includes(p.id)).length >= 4
      );
    case "b-pathfinder":
      return p.privateSurveys.length >= 10 && m.publicReveals >= 8 && m.discountedHabitats.length >= 4;
    case "b-beyond":
      return p.privateSurveys.length >= 12 && hs.filter((h) => h.surveyedBy?.includes(p.id)).length >= 5 && m.frontierLegacyHexes.length >= 2 && new Set(m.surveySales).size >= 3;
    case "sp-urban": {
      const cities = hs.filter((hex) => hex.tier === "Colony" || hex.tier === "Arcology");
      return cities.length >= 2 && cities.reduce((sum, hex) => sum + economic(hex), 0) >= 4;
    }
    case "sp-fortified": {
      const fortified = hs.filter((hex) => hex.centers.includes("defense") && hex.defenseGridOrigin === "spires");
      return fortified.length >= 2 && fortified.some((hex) => hex.tier === "Arcology" && hex.arcologyOrigin === "spires");
    }
    case "sp-arcology":
      return hs.some((hex) => hex.tier === "Arcology" && hex.arcologyOrigin === "spires") && hs.slice().sort((a, b) => economic(b) - economic(a)).slice(0, 3).reduce((sum, hex) => sum + economic(hex), 0) >= 6;
    case "sp-vertical": {
      const cities = hs.filter((hex) => hex.tier === "Arcology" && hex.arcologyOrigin === "spires");
      return cities.length >= 2 && hs.reduce((sum, hex) => sum + economic(hex), 0) >= 8;
    }
    case "sp-horizon":
      return hs.length <= 4 && hs.filter((hex) => hex.tier === "Arcology" && hex.arcologyOrigin === "spires").length >= 2 && hs.reduce((sum, hex) => sum + economic(hex), 0) >= 10 && Math.max(...m.productionTotals) >= 12;
    case "ae-fortress":
      return protectedHabitats.length >= 3 && protectedHabitats.some((hex) => hex.tier !== "Outpost");
    case "ae-arms":
      return new Set(m.aegisPlatformTransfers).size >= 2;
    case "ae-provider":
      return m.aegisPlatformTransfers.length >= 4 && new Set(m.aegisPlatformTransfers).size >= 3;
    case "ae-shield": {
      const home = hs.find((hex) => hex.kind === "home")?.id;
      const away = game.blockades.filter((blockade) => blockade.originFaction === "aegis" && blockade.active && blockade.owner === p.id && blockade.hex !== home).length + hs.filter((hex) => hex.id !== home && hex.defenseGridOrigin === "aegis").length;
      return new Set(m.aegisPlatformTransfers).size >= 3 && away >= 4 && protectedHabitats.length >= 2;
    }
    case "ae-architecture": {
      const assets = game.blockades.filter((blockade) => blockade.originFaction === "aegis" && blockade.active && blockade.owner === p.id).length + hs.filter((hex) => hex.defenseGridOrigin === "aegis" && hex.centers.includes("defense")).length;
      return new Set(m.aegisPlatformTransfers).size >= Math.min(4, game.players.length - 1) && assets >= 6 && activeAgreements(game).filter((agreement) => agreement.parties.includes(p.id)).length >= 3 && new Set(m.aegisForeignBeneficiaries).size >= 3;
    }
    case "wa-voyage": return new Set(m.wayfarerArkshipHexes || []).size >= 3;
    case "wa-caravan": return mobiles.length >= 2;
    case "wa-wandering": return new Set(m.wayfarerProductionHexes).size >= 3;
    case "wa-exodus": return m.wayfarerRelocatedCenters >= 3;
    case "wa-advanced": {
      const support = new Set(game.carriers.filter((carrier) => carrier.owner === p.id && mobiles.some((mobile) => mobile.hex === carrier.hex)).map((carrier) => carrier.id)).size;
      return new Set(m.wayfarerMigrationHexes).size >= 6 && hs.length + mobiles.length >= 4 && support >= 3;
    }
    case "wa-reach":
      return hs.length + mobiles.length >= 5 && m.wayfarerRelocatedCenters >= 3 && new Set(m.wayfarerDeepScans).size >= 8 && mobiles.filter((mobile) => mobile.caravanGuards > 0 || game.carriers.some((carrier) => carrier.owner === p.id && carrier.hex === mobile.hex)).length >= 3;
    case "sa-mission": return new Set(m.salvoBombardTurns).size >= 3;
    case "sa-hire": return m.salvoGunForHireEvents >= 3 && new Set(m.salvoGunForHireTargets).size >= 2;
    case "sa-superiority": return m.salvoBombardKills >= 6 && new Set(m.salvoBombardTargets).size >= 2;
    case "sa-network": return new Set(m.salvoBombardTurns).size >= 6 && new Set(m.salvoBombardTargets).size >= 3 && m.salvoBombardKills >= 6;
    case "sa-dominion": return m.salvoBombardments >= 10 && new Set(m.salvoBombardTargets).size >= Math.min(4, game.players.length - 1) && m.salvoBombardKills >= 10 && game.carriers.filter((carrier) => carrier.owner === p.id && (carrierLibrary[carrier.type].bombard || carrier.type === "siegeTender")).length >= 3;
    case "gu-specialized": return new Set(hs.flatMap((hex) => hex.centers.filter((center) => !["defense", "labor", "factory"].includes(center)))).size >= 3;
    case "gu-masterworks": return enhanced.length >= 2;
    case "gu-engine": return Math.max(...m.productionTotals) >= 10 && enhanced.length >= 4;
    case "gu-advanced": return enhanced.length >= 6 && new Set(enhanced.map((entry) => entry.center)).size >= 4;
    case "gu-masters": return enhanced.length >= 8 && new Set(enhanced.map((entry) => entry.hex.id)).size >= 4 && Math.max(...m.productionTotals) >= 14;
    default:
      return false;
  }
}

export function evaluateLegacy(game: GameState) {
  if (game.result) return;
  for (const objective of universalLegacy.filter(
    (o) =>
      o.era <= game.era &&
      o.automatic &&
      !game.universalClaims.some((c) => c.objectiveId === o.id),
  )) {
    const qualifying = game.players.filter((p) =>
      universalSatisfied(game, p, objective.id),
    );
    // Orders resolve together. Every civilization that first satisfies a
    // shared objective in the same resolution earns it before it closes.
    if (qualifying.length > 0) for (const contender of qualifying) {
      awardLegacy(
        game,
        contender.id,
        "universal",
        objective.lp,
        objective.name,
      );
      game.universalClaims.push({
        objectiveId: objective.id,
        playerId: contender.id,
        turn: game.turn,
        lp: objective.lp,
      });
    }
  }
  for (const p of game.players)
    for (const objective of civilizationObjectives(p).filter(
      (o) => o.automatic && !p.civilizationClaims.includes(o.id),
    ))
      if (civilizationSatisfied(game, p, objective.id)) {
        p.civilizationClaims.push(objective.id);
        awardLegacy(game, p.id, "civilization", objective.lp, objective.name);
      }
}

export function drawHiddenChoices(
  game: GameState,
  playerId: number,
  era: number,
) {
  const p = game.players[playerId];
  if (!p) return;
  const deck = hiddenLegacyDeck.filter((c) => c.era === era);
  if (deck.length < 3) return;
  const allowed = new Set(deck.map((card) => card.id));
  const existing = p.hiddenLegacy[era];
  const validExisting = [...new Set((existing?.choices || []).filter((id) => allowed.has(id)))];
  const offset = ((game.seed + playerId * 7 + era * 13) % deck.length + deck.length) % deck.length;
  const generated = [0, 1, 2].map((i) => deck[(offset + i * 3) % deck.length].id);

  if (existing?.selected && allowed.has(existing.selected)) {
    existing.choices = [...new Set([existing.selected, ...validExisting, ...generated])].slice(0, 3);
    return;
  }
  if (existing?.selected || validExisting.length < 3) {
    p.hiddenLegacy[era] = { choices: generated };
    return;
  }
  existing.choices = validExisting.slice(0, 3);
}

export function prepareHiddenChoicesForEra(game: GameState, era = game.era) {
  for (const player of game.players) drawHiddenChoices(game, player.id, era);
}
export function selectHiddenLegacy(
  game: GameState,
  playerId: number,
  cardId: string,
) {
  drawHiddenChoices(game, playerId, game.era);
  const state = game.players[playerId].hiddenLegacy[game.era];
  if (!state.choices.includes(cardId) || state.selected) return false;
  state.selected = cardId;
  return true;
}
export function setHiddenCompleted(
  game: GameState,
  playerId: number,
  completed: boolean,
) {
  const state = game.players[playerId].hiddenLegacy[game.era];
  if (!state?.selected) return false;
  state.completed = completed;
  return true;
}

function hiddenSatisfied(
  game: GameState,
  p: PlayerState,
  card: HiddenLegacyCard,
) {
  const i = card.era - 1,
    m = p.legacyMetrics,
    hs = habitats(game, p.id),
    adv = m.technologyAdvances[i],
    trades = m.tradePartners[i];
  switch (card.id) {
    case "h1-frontier":
      return m.habitatsEstablished[i] >= 1;
    case "h1-first": {
      const economicCenters = hs.reduce(
        (sum, h) => sum + h.centers.filter((center) => center !== "defense").length,
        0,
      );
      return hs.length >= 2 && economicCenters >= 1;
    }
    case "h1-specialist":
      return adv.length >= 1 && p.resources.research >= 2;
    case "h1-renaissance": {
      const pillars =
        Number(adv.length >= 1) +
        Number(m.habitatsEstablished[i] >= 1) +
        Number(m.builtCenters[i] >= 1);
      return pillars >= 2;
    }
    case "h1-merchant":
      return unique(trades) >= 2;
    case "h1-investment":
      return m.receivedTradeValue[i] >= 3;
    case "h1-mobilization": {
      const pillars =
        Number(m.builtVessels[i] >= 1) +
        Number(m.recruitedCU[i] >= 2) +
        Number(m.builtCenters[i] + m.habitatsEstablished[i] >= 1);
      return pillars >= 2;
    }
    case "h1-peace": {
      const pillars =
        Number(m.habitatsEstablished[i] >= 1) +
        Number(adv.length >= 1) +
        Number(m.builtCenters[i] >= 1);
      return pillars >= 2 && m.combatInitiated[i] === 0;
    }
    case "h1-pioneer":
      return p.eraTributes[i] >= 1 && (m.habitatsEstablished[i] >= 1 || adv.length >= 1);
    case "h1-surveyor":
      return m.revealedHexes[i] >= 3;

    case "h2-commerce":
      return unique(trades) >= 3;
    case "h2-labor":
      return m.laborTraded[i] >= 1 || p.laborCap >= 5;
    case "h2-builder":
      return m.upgradedHabitats[i] + m.builtCenters[i] >= 2;
    case "h2-colonial":
      return hs.length >= 3 && hs.some((h) => h.tier !== "Outpost");
    case "h2-arms":
      return totalCombatUnits(game, p.id) >= 6 && m.givenTradeResources[i] >= 2;
    case "h2-science":
      return m.givenResearch[i] >= 2;
    case "h2-diplomatic":
      return unique(m.agreementsEstablished[i]) >= 2;
    case "h2-balanced":
      return techAt(p, 2) >= 3;
    case "h2-guardian":
      return totalCombatUnits(game, p.id) >= 8 && m.combatInitiated[i] === 0;
    case "h2-burden":
      return p.eraTributes[i] >= 1 && m.givenTradeResources[i] >= 2;

    case "h3-tech":
      return adv.some((branch) => p.tech[branch] === 4) && p.resources.research >= 2;
    case "h3-builder":
      return m.builtCenters[i] >= 1 && m.upgradedHabitats[i] >= 1 && m.builtCenters[i] + m.upgradedHabitats[i] >= 3 && new Set(m.habitatDevelopmentHexes[i]).size >= 2;
    case "h3-engine":
      return m.productionTotals[i] >= 9;
    case "h3-mobilization":
      return m.recruitedCU[i] >= 6 && totalCombatUnits(game, p.id) >= 8;
    case "h3-conqueror":
      return m.habitatsCaptured[i] >= 2;
    case "h3-peace":
      return totalCombatUnits(game, p.id) >= 12 && m.combatInitiated[i] === 0;
    case "h3-broker":
      return m.tradeCount[i] >= 4 && unique(trades) >= 3 && activeAgreements(game).filter((agreement) => agreement.parties.includes(p.id)).length >= 3;
    case "h3-supplier":
      return m.givenTradeResources[i] >= 6 && unique(m.givenTradePartners[i]) >= 3;
    case "h3-architect": {
      const items =
        m.builtVessels[i] +
        m.builtCenters[i] +
        m.upgradedHabitats[i] +
        m.habitatsEstablished[i];
      const categories = [
        m.builtVessels[i],
        m.builtCenters[i],
        m.upgradedHabitats[i] + m.habitatsEstablished[i],
      ].filter((value) => value > 0).length;
      return items >= 4 && categories >= 3;
    }
    case "h3-leadership":
      return p.eraTributes[i] >= 1 && p.tributes >= Math.max(...game.players.map((player) => player.tributes)) && m.givenTradeResources[i] >= 2;

    case "h4-science":
      return techAt(p, 4) >= 2;
    case "h4-great":
      return hs.length >= 5 && hs.filter((h) => h.tier === "Metropolis").length >= 2;
    case "h4-arsenal":
      return totalCombatUnits(game, p.id) >= 12;
    case "h4-conquest":
      return m.metropolisCaptured[i] >= 1;
    case "h4-partner":
      return agreementPartners(game, p.id) >= Math.max(1, game.players.length - 3);
    case "h4-economy":
      return p.resources.currency + p.resources.material + p.resources.research >= 10;
    case "h4-expansion":
      return m.habitatsEstablished[i] + m.habitatsCaptured[i] >= 2;
    case "h4-compromise":
      return unique(trades) >= 3 && p.eraTributes[i] >= 1;
    case "h4-savior":
      return p.eraTributes[i] >= 2;
    case "h4-complete":
      return techAt(p, 3) >= 4 && hs.length >= 3 && agreementPartners(game, p.id) >= 1;

    case "h5-great":
      return m.builtCenters[i] >= 1 && m.upgradedHabitats[i] >= 1 && m.builtCenters[i] + m.upgradedHabitats[i] >= 4 && new Set(m.habitatDevelopmentHexes[i]).size >= 3;
    case "h5-command":
      return m.combatWinsAgainst.length >= 2;
    case "h5-commerce":
      return m.tradeCount[i] >= 5 && unique(trades) >= 3 && m.givenTradeResources[i] >= 5 && m.receivedTradeValue[i] >= 5;
    case "h5-science":
      return new Set(adv).size >= 2 && p.resources.research >= 3;
    case "h5-federal":
      return unique(m.agreementsEstablished[i]) >= 2 && activeAgreements(game).filter((agreement) => agreement.parties.includes(p.id)).length >= 4 && agreementPartners(game, p.id) >= 3;
    case "h5-reserve":
      return p.resources.material + p.resources.currency + p.resources.research >= 10 && totalCombatUnits(game, p.id) >= 10 && p.resources.influence >= 2;
    case "h5-expansion":
      return m.habitatsEstablished[i] + m.habitatsCaptured[i] >= 2 && new Set(m.habitatDevelopmentHexes[i]).size >= 3;
    case "h5-steward": {
      const alternate = game.gate >= gateTarget(game) && (adv.length >= 2 || m.builtCenters[i] + m.upgradedHabitats[i] >= 2);
      return (p.eraTributes[i] >= 1 || alternate) && m.givenTradeResources[i] >= 4 && p.resources.influence >= 2;
    }
    case "h5-peace":
      return totalCombatUnits(game, p.id) >= 14 && m.combatInitiated[i] === 0 && unique(m.agreementsEstablished[i]) >= 1;
    case "h5-motion":
      return [adv.length, m.builtCenters[i], m.upgradedHabitats[i], m.builtVessels[i], m.recruitedCU[i], m.agreementsEstablished[i].length].filter((value) => value > 0).length >= 4;
    default:
      return false;
  }
}

export type LegacyProgress = {
  current: number;
  target: number;
  label: string;
  complete: boolean;
};

const progress = (current: number, target: number, label?: string): LegacyProgress => ({
  current: Math.min(current, target),
  target,
  label: label || `${Math.min(current, target)} / ${target}`,
  complete: current >= target,
});

export function legacyObjectiveProgress(
  game: GameState,
  playerId: number,
  objectiveId: string,
): LegacyProgress {
  const p = game.players[playerId],
    m = p.legacyMetrics,
    hs = habitats(game, playerId),
    card = hiddenLegacyDeck.find((candidate) => candidate.id === objectiveId),
    eraIndex = (card?.era || game.era) - 1,
    adv = m.technologyAdvances[eraIndex] || [],
    trades = m.tradePartners[eraIndex] || [],
    hidden = card ? p.hiddenLegacy[card.era] : undefined;
  const completed = game.universalClaims.some((claim) => claim.objectiveId === objectiveId && claim.playerId === playerId) ||
    p.civilizationClaims.includes(objectiveId) ||
    (!!card && hidden?.scored === true && hidden.completed === true);
  if (completed) return progress(1, 1, "Completed");
  if (/^(sp|ae|wa|sa|gu)-/.test(objectiveId)) {
    const met = civilizationSatisfied(game, p, objectiveId);
    const economic = (hex: typeof hs[number]) => hex.centers.filter((center) => center !== "defense" && center !== "factory").length;
    const cities = hs.filter((hex) => hex.tier === "Colony" || hex.tier === "Arcology");
    const metros = hs.filter((hex) => hex.tier === "Metropolis" || hex.tier === "Arcology");
    const protectedHabitats = hs.filter((hex) => hex.centers.includes("defense") || game.blockades.some((asset) => asset.owner === playerId && asset.active && asset.hex === hex.id));
    const mobiles = game.mobileHabitats.filter((asset) => asset.owner === playerId);
    const enhanced = hs.flatMap((hex) => (hex.enhancedCenterIndices || []).map((index) => ({ hex, center: hex.centers[index] }))).filter((entry) => entry.center && !["defense", "labor", "factory"].includes(entry.center));
    const partial = (label: string, parts: Array<[number, number]>) =>
      progress(parts.reduce((sum, [value, target]) => sum + Math.min(1, Math.max(0, value) / target), 0), parts.length,
        met ? `${label} · complete` : label);
    switch (objectiveId) {
      case "sp-urban": return partial(`Cities ${cities.length}/2 · economic Centers ${cities.reduce((sum, hex) => sum + economic(hex), 0)}/4`, [[cities.length, 2], [cities.reduce((sum, hex) => sum + economic(hex), 0), 4]]);
      case "sp-fortified": { const fortified = hs.filter((hex) => hex.centers.includes("defense") && hex.defenseGridOrigin === "spires"); return partial(`Spires grids ${fortified.length}/2 · fortified Arcology ${fortified.some((hex) => hex.tier === "Arcology" && hex.arcologyOrigin === "spires") ? "yes" : "no"}`, [[fortified.length, 2], [Number(fortified.some((hex) => hex.tier === "Arcology" && hex.arcologyOrigin === "spires")), 1]]); }
      case "sp-arcology": { const arcology = hs.some((hex) => hex.tier === "Arcology" && hex.arcologyOrigin === "spires"); const centers = hs.slice().sort((a, b) => economic(b) - economic(a)).slice(0, 3).reduce((sum, hex) => sum + economic(hex), 0); return partial(`Arcology ${arcology ? "yes" : "no"} · top 3 Centers ${centers}/6`, [[Number(arcology), 1], [centers, 6]]); }
      case "sp-vertical": { const arcs = hs.filter((hex) => hex.tier === "Arcology" && hex.arcologyOrigin === "spires"); return partial(`Arcologies ${arcs.length}/2 · economic Centers ${hs.reduce((sum, hex) => sum + economic(hex), 0)}/8`, [[arcs.length, 2], [hs.reduce((sum, hex) => sum + economic(hex), 0), 8]]); }
      case "sp-horizon": { const arcs = hs.filter((hex) => hex.tier === "Arcology" && hex.arcologyOrigin === "spires"); return partial(`Habitats ${hs.length}/4 max · Arcologies ${arcs.length}/2 · Centers ${hs.reduce((sum, hex) => sum + economic(hex), 0)}/10 · peak production ${Math.max(0, ...m.productionTotals)}/12`, [[Number(hs.length <= 4), 1], [arcs.length, 2], [hs.reduce((sum, hex) => sum + economic(hex), 0), 10], [Math.max(0, ...m.productionTotals), 12]]); }
      case "ae-fortress": return partial(`Protected Habitats ${protectedHabitats.length}/3 · developed ${protectedHabitats.some((hex) => hex.tier !== "Outpost") ? "yes" : "no"}`, [[protectedHabitats.length, 3], [Number(protectedHabitats.some((hex) => hex.tier !== "Outpost")), 1]]);
      case "ae-arms": return partial(`Transfer partners ${new Set(m.aegisPlatformTransfers).size}/2`, [[new Set(m.aegisPlatformTransfers).size, 2]]);
      case "ae-provider": return partial(`Transfers ${m.aegisPlatformTransfers.length}/4 · partners ${new Set(m.aegisPlatformTransfers).size}/3`, [[m.aegisPlatformTransfers.length, 4], [new Set(m.aegisPlatformTransfers).size, 3]]);
      case "ae-shield": { const homeId = hs.find((hex) => hex.kind === "home")?.id; const away = game.blockades.filter((asset) => asset.originFaction === "aegis" && asset.active && asset.owner === playerId && asset.hex !== homeId).length + hs.filter((hex) => hex.id !== homeId && hex.defenseGridOrigin === "aegis").length; return partial(`Partners ${new Set(m.aegisPlatformTransfers).size}/3 · away assets ${away}/4 · protected Habitats ${protectedHabitats.length}/2`, [[new Set(m.aegisPlatformTransfers).size, 3], [away, 4], [protectedHabitats.length, 2]]); }
      case "ae-architecture": { const assets = game.blockades.filter((asset) => asset.originFaction === "aegis" && asset.active && asset.owner === playerId).length + hs.filter((hex) => hex.defenseGridOrigin === "aegis" && hex.centers.includes("defense")).length; const partners = Math.min(4, game.players.length - 1); return partial(`Partners ${new Set(m.aegisPlatformTransfers).size}/${partners} · assets ${assets}/6 · agreements ${activeAgreements(game).filter((agreement) => agreement.parties.includes(playerId)).length}/3 · beneficiaries ${new Set(m.aegisForeignBeneficiaries).size}/3`, [[new Set(m.aegisPlatformTransfers).size, partners], [assets, 6], [activeAgreements(game).filter((agreement) => agreement.parties.includes(playerId)).length, 3], [new Set(m.aegisForeignBeneficiaries).size, 3]]); }
      case "wa-caravan": return partial(`Mobile Habitats ${mobiles.length}/2`, [[mobiles.length, 2]]);
      case "wa-voyage": return partial(`Arkship migration hexes ${new Set(m.wayfarerArkshipHexes || []).size}/3`, [[new Set(m.wayfarerArkshipHexes || []).size, 3]]);
      case "wa-wandering": return partial(`Production hexes ${new Set(m.wayfarerProductionHexes).size}/3`, [[new Set(m.wayfarerProductionHexes).size, 3]]);
      case "wa-exodus": return partial(`Relocated Centers ${m.wayfarerRelocatedCenters}/3`, [[m.wayfarerRelocatedCenters, 3]]);
      case "wa-advanced": { const support = new Set(game.carriers.filter((carrier) => carrier.owner === playerId && mobiles.some((mobile) => mobile.hex === carrier.hex)).map((carrier) => carrier.id)).size; return partial(`Migration hexes ${new Set(m.wayfarerMigrationHexes).size}/6 · Habitats ${hs.length + mobiles.length}/4 · escorts ${support}/3`, [[new Set(m.wayfarerMigrationHexes).size, 6], [hs.length + mobiles.length, 4], [support, 3]]); }
      case "wa-reach": { const guarded = mobiles.filter((mobile) => mobile.caravanGuards > 0 || game.carriers.some((carrier) => carrier.owner === playerId && carrier.hex === mobile.hex)).length; return partial(`Habitats ${hs.length + mobiles.length}/5 · relocated ${m.wayfarerRelocatedCenters}/3 · deep scans ${new Set(m.wayfarerDeepScans).size}/8 · guarded ${guarded}/3`, [[hs.length + mobiles.length, 5], [m.wayfarerRelocatedCenters, 3], [new Set(m.wayfarerDeepScans).size, 8], [guarded, 3]]); }
      case "sa-mission": return partial(`Bombardment Turns ${new Set(m.salvoBombardTurns).size}/3`, [[new Set(m.salvoBombardTurns).size, 3]]);
      case "sa-hire": return partial(`Gun for Hire events ${m.salvoGunForHireEvents}/3 · targets ${new Set(m.salvoGunForHireTargets).size}/2`, [[m.salvoGunForHireEvents, 3], [new Set(m.salvoGunForHireTargets).size, 2]]);
      case "sa-superiority": return partial(`Bombardment kills ${m.salvoBombardKills}/6 · targets ${new Set(m.salvoBombardTargets).size}/2`, [[m.salvoBombardKills, 6], [new Set(m.salvoBombardTargets).size, 2]]);
      case "sa-network": return partial(`Bombardment Turns ${new Set(m.salvoBombardTurns).size}/6 · targets ${new Set(m.salvoBombardTargets).size}/3 · kills ${m.salvoBombardKills}/6`, [[new Set(m.salvoBombardTurns).size, 6], [new Set(m.salvoBombardTargets).size, 3], [m.salvoBombardKills, 6]]);
      case "sa-dominion": { const artillery = game.carriers.filter((carrier) => carrier.owner === playerId && (carrierLibrary[carrier.type].bombard || carrier.type === "siegeTender")).length; const targets = Math.min(4, game.players.length - 1); return partial(`Bombardments ${m.salvoBombardments}/10 · targets ${new Set(m.salvoBombardTargets).size}/${targets} · kills ${m.salvoBombardKills}/10 · artillery ${artillery}/3`, [[m.salvoBombardments, 10], [new Set(m.salvoBombardTargets).size, targets], [m.salvoBombardKills, 10], [artillery, 3]]); }
      case "gu-specialized": return partial(`Economic Center types ${new Set(hs.flatMap((hex) => hex.centers.filter((center) => !["defense", "labor", "factory"].includes(center)))).size}/3`, [[new Set(hs.flatMap((hex) => hex.centers.filter((center) => !["defense", "labor", "factory"].includes(center)))).size, 3]]);
      case "gu-masterworks": return partial(`Enhanced Centers ${enhanced.length}/2`, [[enhanced.length, 2]]);
      case "gu-engine": return partial(`Peak production ${Math.max(0, ...m.productionTotals)}/10 · Enhanced Centers ${enhanced.length}/4`, [[Math.max(0, ...m.productionTotals), 10], [enhanced.length, 4]]);
      case "gu-advanced": return partial(`Enhanced Centers ${enhanced.length}/6 · types ${new Set(enhanced.map((entry) => entry.center)).size}/4`, [[enhanced.length, 6], [new Set(enhanced.map((entry) => entry.center)).size, 4]]);
      case "gu-masters": return partial(`Enhanced Centers ${enhanced.length}/8 · Habitats ${new Set(enhanced.map((entry) => entry.hex.id)).size}/4 · peak production ${Math.max(0, ...m.productionTotals)}/14`, [[enhanced.length, 8], [new Set(enhanced.map((entry) => entry.hex.id)).size, 4], [Math.max(0, ...m.productionTotals), 14]]);
      default: return progress(met ? 1 : 0, 1, met ? "Requirements met" : "Progress unavailable");
    }
  }

  switch (objectiveId) {
    case "beyond-frontier": return progress(m.habitatsEstablished[0], 3);
    case "interstellar-commerce": return progress(unique(m.tradePartners[0]), 3);
    case "renaissance": return progress(techAt(p, 2), 3, `${techAt(p, 2)} / 3 branches at Level II`);
    case "first-foundations": {
      const centers = economicCenters(game, playerId);
      return progress(Number(hs.length >= 2) + Number(centers >= 2), 2, `Habitats ${hs.length}/2 · Economic Centers ${centers}/2`);
    }
    case "prepared-civilization": {
      const carriers = game.carriers.filter((carrier) => carrier.owner === playerId).length;
      const cu = totalCombatUnits(game, playerId);
      return progress(Number(cu >= 6) + Number(carriers >= 2), 2, `CU ${cu}/6 · Military vessels ${carriers}/2`);
    }
    case "first-conquest": return progress(m.habitatsCaptured.reduce((sum, count) => sum + count, 0), 1);
    case "hold-the-line": return progress((m.defendedHabitats || []).length, 1);
    case "veteran-command": return progress(m.combatWinsAgainst.length, 2);
    case "hub-civilization": {
      const kinds = new Set(hs.filter((h) => h.tier !== "Outpost").map((h) => h.kind));
      return progress(kinds.size, 3, `${Math.min(kinds.size, 3)} / 3 Colony resource types`);
    }
    case "diplomatic-network": return progress(agreementPartners(game, playerId), 3);
    case "developed-frontier": {
      const centers = economicCenters(game, playerId), colonies = hs.filter((hex) => hex.tier !== "Outpost").length;
      return progress(Number(hs.length >= 3) + Number(colonies >= 1) + Number(centers >= 3), 3, `Habitats ${hs.length}/3 · Colonies ${colonies}/1 · Centers ${centers}/3`);
    }
    case "technological-momentum": {
      const levelTwo = techAt(p, 2), levelThree = techAt(p, 3);
      return progress(Number(levelTwo >= 4) + Number(levelThree >= 1), 2, `Level II ${levelTwo}/4 · Level III ${levelThree}/1`);
    }
    case "secured-frontier": {
      const presence = [...militaryHexes(game, playerId)].filter((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "home").length;
      const cu = totalCombatUnits(game, playerId);
      return progress(Number(hs.length >= 3) + Number(cu >= 8) + Number(presence >= 2), 3, `Habitats ${hs.length}/3 · CU ${cu}/8 · Military hexes ${presence}/2`);
    }
    case "joint-venture":
    case "coalition": return progress(0, 1, "Table confirmation required");
    case "master-discipline": {
      const level = Math.max(...Object.values(p.tech));
      return progress(level, 4, `Highest branch: Level ${level} / IV`);
    }
    case "systemic-economy": return progress(new Set(m.productionTypes[2]).size, 5, `${new Set(m.productionTypes[2]).size} / 5 production types`);
    case "great-works": {
      const actions = m.builtCenters[2] + m.upgradedHabitats[2], hexes = new Set(m.habitatDevelopmentHexes[2]).size;
      return progress(Number(actions >= 3) + Number(m.builtCenters[2] >= 1) + Number(m.upgradedHabitats[2] >= 1) + Number(hexes >= 2), 4, `Developments ${actions}/3 · Centers ${m.builtCenters[2]}/1 · Upgrades ${m.upgradedHabitats[2]}/1 · Habitats ${hexes}/2`);
    }
    case "projection-power": {
      const home = game.hexes.find((hex) => hex.kind === "home" && hex.originalOwner === playerId)?.id || "";
      const presence = [...militaryHexes(game, playerId)].filter((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "home");
      const distant = presence.some((id) => home && hexDistance(id, home) >= 3);
      const cu = totalCombatUnits(game, playerId);
      return progress(Number(cu >= 10) + Number(presence.length >= 3) + Number(distant), 3, `CU ${cu}/10 · Military hexes ${presence.length}/3 · Distant force ${distant ? "yes" : "no"}`);
    }
    case "architect-horizon": return progress(p.eraTributes.filter((value) => value > 0).length, 4, `${p.eraTributes.filter((value) => value > 0).length} / 4 Eras contributed`);
    case "metropolis-stars": return progress(hs.filter((h) => h.tier === "Metropolis" || h.tier === "Arcology").length, 3);
    case "nexus-humanity": {
      const agreements = agreementPartners(game, playerId), branches = techAt(p, 3);
      const parts = Number(agreements >= 3) + Number(hs.length >= 4) + Number(branches >= 3);
      return progress(parts, 3, `Agreements ${agreements}/3 · Habitats ${hs.length}/4 · Level III ${branches}/3`);
    }
    case "civilization-scale": {
      const agreements = agreementPartners(game, playerId), branches = techAt(p, 3), cu = totalCombatUnits(game, playerId);
      return progress(Number(hs.length >= 4) + Number(cu >= 8) + Number(agreements >= 3) + Number(branches >= 3), 4, `Habitats ${hs.length}/4 · CU ${cu}/8 · Agreements ${agreements}/3 · Level III ${branches}/3`);
    }
    case "system-power": {
      const cu = totalCombatUnits(game, playerId), capacity = carrierCapacity(game, playerId), levelFour = techAt(p, 4);
      return progress(Number(cu >= 12) + Number(capacity >= 16) + Number(levelFour >= 1), 3, `CU ${cu}/12 · Capacity ${capacity}/16 · Level IV ${levelFour}/1`);
    }
    case "system-architect": {
      const actions = (m.builtCenters[4] || 0) + (m.upgradedHabitats[4] || 0), hexes = new Set(m.habitatDevelopmentHexes[4] || []).size;
      return progress(Number(actions >= 3) + Number((m.upgradedHabitats[4] || 0) >= 1) + Number(hexes >= 2), 3, `Developments ${actions}/3 · Upgrades ${m.upgradedHabitats[4] || 0}/1 · Habitats ${hexes}/2`);
    }
    case "strategic-supremacy": {
      const cu = totalCombatUnits(game, playerId), capacity = carrierCapacity(game, playerId);
      const presence = [...militaryHexes(game, playerId)].filter((id) => game.hexes.find((hex) => hex.id === id)?.kind !== "home").length;
      return progress(Number(cu >= 14) + Number(capacity >= 18) + Number(presence >= 3), 3, `CU ${cu}/14 · Capacity ${capacity}/18 · Military hexes ${presence}/3`);
    }
    case "interstellar-institution": {
      const agreements = activeAgreements(game).filter((agreement) => agreement.parties.includes(playerId)).length;
      const partners = agreementPartners(game, playerId);
      return progress(Number(agreements >= 4) + Number(partners >= 3) + Number(p.resources.influence >= 3), 3, `Agreements ${agreements}/4 · Partners ${partners}/3 · Influence ${p.resources.influence}/3`);
    }
    case "complete-civilization-v": {
      const types = new Set(hs.flatMap((hex) => hex.centers.filter((center) => center !== "defense"))).size;
      const branches = techAt(p, 3), cu = totalCombatUnits(game, playerId);
      return progress(Number(hs.length >= 4) + Number(types >= 4) + Number(branches >= 4) + Number(cu >= 10), 4, `Habitats ${hs.length}/4 · Center types ${types}/4 · Level III ${branches}/4 · CU ${cu}/10`);
    }
    case "legacy-power": {
      const military = (m.builtVessels[4] || 0) > 0 || (m.recruitedCU[4] || 0) > 0;
      const categories = Number((p.eraTributes[4] || 0) > 0 || military) + Number((m.technologyAdvances[4] || []).length > 0) + Number((m.builtCenters[4] || 0) + (m.upgradedHabitats[4] || 0) > 0) + Number((m.tradePartners[4] || []).length > 0);
      return progress(categories, 4, `${categories} / 4 Legacy action categories`);
    }
    case "v-mobilized": return progress(totalCombatUnits(game, playerId), 10, `${totalCombatUnits(game, playerId)} / 10 CU`);
    case "v-fleet": {
      const capacity = game.carriers.filter((carrier) => carrier.owner === playerId).reduce((sum, carrier) => sum + carrierLibrary[carrier.type].capacity, 0);
      return progress(capacity, 20, `${capacity} / 20 Capacity`);
    }
    case "v-conquest": return progress(hs.filter((h) => h.originalOwner !== undefined && h.originalOwner !== playerId).length, 2);
    case "v-campaign": return progress(Number(m.combatWinsAgainst.length >= 3) + Number(hs.some((h) => h.originalOwner !== undefined && h.originalOwner !== playerId)), 2, `Rivals defeated ${m.combatWinsAgainst.length}/3 · Captured Habitat ${hs.some((h) => h.originalOwner !== undefined && h.originalOwner !== playerId) ? "yes" : "no"}`);
    case "v-dominion": {
      const captured = hs.filter((h) => h.originalOwner !== undefined && h.originalOwner !== playerId).length, cu = totalCombatUnits(game, playerId);
      return progress(Number(m.combatWinsAgainst.length >= Math.min(4, game.players.length - 1)) + Number(captured >= 3) + Number(cu >= 14), 3, `Rivals defeated ${m.combatWinsAgainst.length}/${Math.min(4, game.players.length - 1)} · Captured Habitats ${captured}/3 · CU ${cu}/14`);
    }
    case "h-network": {
      const centers = hs.reduce((sum, h) => sum + h.centers.filter((center) => center === "research").length, 0);
      return progress(centers, 3, `${centers} / 3 Research Centers`);
    }
    case "h-breadth": return progress(techAt(p, 3), 3, `${techAt(p, 3)} / 3 branches at Level III`);
    case "h-export": return progress(p.diplomacy.technologyExportPartners.length, 2);
    case "h-leadership": {
      const levelFour = techAt(p, 4), centers = hs.reduce((sum, h) => sum + h.centers.filter((center) => center === "research").length, 0);
      return progress(Number(levelFour >= 2) + Number(centers >= 4), 2, `Level IV ${levelFour}/2 · Research Centers ${centers}/4`);
    }
    case "h-synthesis": {
      const levelThree = techAt(p, 3), levelFour = techAt(p, 4), exports = p.diplomacy.technologyExportPartners.length;
      return progress(Number(levelThree >= 5) + Number(levelFour >= 3) + Number(exports >= Math.min(3, game.players.length - 1)), 3, `Level III ${levelThree}/5 · Level IV ${levelFour}/3 · Export partners ${exports}/${Math.min(3, game.players.length - 1)}`);
    }
    case "f-engine": {
      const material = Math.max(...m.productionAmounts.map((amount) => amount.material));
      return progress(material, 4, `${material} / 4 Material in one Production`);
    }
    case "f-prospect": return progress(m.prospectedHexes.length, 4);
    case "f-industry": {
      const centerCount = hs.reduce((sum, h) => sum + h.centers.filter((center) => center !== "defense").length, 0),
        habitatCount = hs.filter((h) => h.centers.some((center) => center !== "defense")).length,
        parts = Number(centerCount >= 5) + Number(habitatCount >= 3);
      return progress(parts, 2, `Economic Centers ${centerCount}/5 · Habitats ${habitatCount}/3`);
    }
    case "f-worldworks": return progress(m.habitatDevelopmentHexes.flat().length, 10, `${m.habitatDevelopmentHexes.flat().length} / 10 development actions`);
    case "f-civilization": {
      const centers = economicCenters(game, playerId), metros = hs.filter((h) => h.tier === "Metropolis").length;
      const material = hs.reduce((sum, h) => sum + h.centers.filter((center) => center === "material").length, 0);
      return progress(Number(hs.length >= 5) + Number(centers >= 8) + Number(metros >= 2) + Number(material >= 3), 4, `Habitats ${hs.length}/5 · Centers ${centers}/8 · Metropolises ${metros}/2 · Material Centers ${material}/3`);
    }
    case "a-service": return progress(new Set(game.civilianUnits.filter((unit) => unit.owner === playerId && unit.type === "envoy").map((unit) => game.hexes.find((hex) => hex.id === unit.hex)?.owner).filter((owner): owner is number => owner !== undefined && owner !== playerId)).size, 2);
    case "a-web": return progress(agreementPartners(game, playerId), 3);
    case "a-influence": return progress(p.diplomacy.bonusInfluenceGained || 0, 5, `${p.diplomacy.bonusInfluenceGained || 0} / 5 bonus Influence`);
    case "a-broker": return progress(new Set(m.aurelianInfluenceTradePartners || []).size, 3, `${new Set(m.aurelianInfluenceTradePartners || []).size} / 3 Influence trade partners`);
    case "a-exchange": return progress(m.aurelianMarketInfluenceSpent || 0, 8, `${m.aurelianMarketInfluenceSpent || 0} / 8 Influence spent at Market`);
    case "a-concert": {
      const agreements = activeAgreements(game).filter((agreement) => agreement.parties.includes(playerId)), partners = agreementPartners(game, playerId);
      const types = new Set(agreements.map((agreement) => agreement.type)).size;
      const neededPartners = Math.min(4, game.players.length - 1);
      return progress(Number(partners >= neededPartners) + Number(types >= 3) + Number(p.resources.influence >= 4), 3, `Partners ${partners}/${neededPartners} · Agreement types ${types}/3 · Influence ${p.resources.influence}/4`);
    }
    case "a-consensus": {
      const active = activeAgreements(game).filter((agreement) => agreement.parties.includes(playerId)).length;
      const bonus = p.diplomacy.bonusInfluenceGained || 0;
      return progress(Number(p.diplomacy.firstAgreementPartners.length >= game.players.length - 1) + Number(active >= 5) + Number(bonus >= 10), 3, `First agreements ${p.diplomacy.firstAgreementPartners.length}/${game.players.length - 1} · Active ${active}/5 · Bonus Influence ${bonus}/10`);
    }
    case "m-broker": return progress(new Set(m.brokeragePairs.map((pair) => pair.split(":").pop())).size, 3);
    case "m-network": return progress(agreementPartners(game, playerId, ["trade", "alliance"]), 3);
    case "m-hegemony": return progress(m.marketCurrencyEarned, 8, `${m.marketCurrencyEarned} / 8 Currency`);
    case "m-exchange": return progress(Number(m.directTradePartners.length >= game.players.length - 1) + Number(m.brokerageTransactions >= 6), 2, `Trade partners ${m.directTradePartners.length}/${game.players.length - 1} · Brokerages ${m.brokerageTransactions}/6`);
    case "m-commercial": return progress(Number(m.marketCurrencyEarned >= 15) + Number(agreementPartners(game, playerId, ["trade", "alliance"]) >= Math.min(4, game.players.length - 1)) + Number(m.directTradeCount >= 10), 3, `Market Currency ${m.marketCurrencyEarned}/15 · Trade relations ${agreementPartners(game, playerId, ["trade", "alliance"])}/${Math.min(4, game.players.length - 1)} · Trades ${m.directTradeCount}/10`);
    case "b-survey": return progress(p.privateSurveys.length, 6);
    case "b-frontier": return progress(m.discountedHabitats.length, 3);
    case "b-information": {
      const sales = new Set(m.surveySales).size, controlled = hs.filter((h) => h.surveyedBy?.includes(playerId)).length;
      return progress(Number(sales >= 3) + Number(controlled >= 4), 2, `Survey buyers ${sales}/3 · Surveyed Habitats ${controlled}/4`);
    }
    case "b-pathfinder": return progress(Number(p.privateSurveys.length >= 10) + Number(m.publicReveals >= 8) + Number(m.discountedHabitats.length >= 4), 3, `Surveys ${p.privateSurveys.length}/10 · Public reveals ${m.publicReveals}/8 · Discounted Habitats ${m.discountedHabitats.length}/4`);
    case "b-beyond": {
      const controlled = hs.filter((h) => h.surveyedBy?.includes(playerId)).length, sales = new Set(m.surveySales).size;
      return progress(Number(p.privateSurveys.length >= 12) + Number(controlled >= 5) + Number(m.frontierLegacyHexes.length >= 2) + Number(sales >= 3), 4, `Surveys ${p.privateSurveys.length}/12 · Surveyed Habitats ${controlled}/5 · Frontier Legacy ${m.frontierLegacyHexes.length}/2 · Buyers ${sales}/3`);
    }
    case "h1-frontier":
      return progress(m.habitatsEstablished[eraIndex], 1);
    case "h1-first": {
      const centers = hs.reduce(
        (sum, h) => sum + h.centers.filter((center) => center !== "defense").length,
        0,
      );
      const parts = Number(hs.length >= 2) + Number(centers >= 1);
      return progress(parts, 2, `Habitats ${hs.length}/2 · Economic Centers ${centers}/1`);
    }
    case "h1-specialist": {
      const parts = Number(adv.length >= 1) + Number(p.resources.research >= 2);
      return progress(parts, 2, `Technology advances ${adv.length}/1 · Stored Research ${p.resources.research}/2`);
    }
    case "h1-renaissance": {
      const pillars =
        Number(adv.length >= 1) +
        Number(m.habitatsEstablished[eraIndex] >= 1) +
        Number(m.builtCenters[eraIndex] >= 1);
      return progress(
        pillars,
        2,
        `Complete 2: Tech ${adv.length >= 1 ? "yes" : "no"} · Habitat ${m.habitatsEstablished[eraIndex] >= 1 ? "yes" : "no"} · Center ${m.builtCenters[eraIndex] >= 1 ? "yes" : "no"}`,
      );
    }
    case "h1-merchant":
      return progress(unique(trades), 2);
    case "h1-investment":
      return progress(m.receivedTradeValue[eraIndex], 3, `${m.receivedTradeValue[eraIndex]} / 3 trade value`);
    case "h1-mobilization": {
      const pillars =
        Number(m.builtVessels[eraIndex] >= 1) +
        Number(m.recruitedCU[eraIndex] >= 2) +
        Number(m.builtCenters[eraIndex] + m.habitatsEstablished[eraIndex] >= 1);
      return progress(
        pillars,
        2,
        `Complete 2: Vessel ${m.builtVessels[eraIndex] >= 1 ? "yes" : "no"} · Recruit ${m.recruitedCU[eraIndex] >= 2 ? "yes" : "no"} · Center/Habitat ${m.builtCenters[eraIndex] + m.habitatsEstablished[eraIndex] >= 1 ? "yes" : "no"}`,
      );
    }
    case "h1-peace": {
      const pillars =
        Number(m.habitatsEstablished[eraIndex] >= 1) +
        Number(adv.length >= 1) +
        Number(m.builtCenters[eraIndex] >= 1);
      const complete = pillars >= 2 && m.combatInitiated[eraIndex] === 0;
      return {
        current: complete ? 2 : Math.min(pillars, 2),
        target: 2,
        label: `Development ${Math.min(pillars, 2)}/2 · Initiated combat ${m.combatInitiated[eraIndex]}`,
        complete,
      };
    }
    case "h1-pioneer": {
      const development = Number(m.habitatsEstablished[eraIndex] >= 1 || adv.length >= 1);
      const tribute = Number(p.eraTributes[eraIndex] >= 1);
      return progress(tribute + development, 2, `Tribute ${tribute}/1 · Habitat or Tech ${development}/1`);
    }
    case "h1-surveyor":
      return progress(m.revealedHexes[eraIndex], 3);

    case "h2-commerce":
      return progress(unique(trades), 3);
    case "h2-labor": {
      const complete = m.laborTraded[eraIndex] >= 1 || p.laborCap >= 5;
      return progress(complete ? 1 : 0, 1, `Labor trades ${m.laborTraded[eraIndex]} · Labor Capacity ${p.laborCap}/5`);
    }
    case "h2-builder":
      return progress(m.upgradedHabitats[eraIndex] + m.builtCenters[eraIndex], 2, `${m.upgradedHabitats[eraIndex] + m.builtCenters[eraIndex]} / 2 development actions`);
    case "h2-colonial": {
      const colonies = hs.filter((h) => h.tier !== "Outpost").length;
      const parts = Number(hs.length >= 3) + Number(colonies >= 1);
      return progress(parts, 2, `Habitats ${hs.length}/3 · Colonies+ ${colonies}/1`);
    }
    case "h2-arms": {
      const cu = totalCombatUnits(game, playerId);
      const given = m.givenTradeResources[eraIndex];
      const parts = Number(cu >= 6) + Number(given >= 2);
      return progress(parts, 2, `CU ${cu}/6 · Resources provided ${given}/2`);
    }
    case "h2-science":
      return progress(m.givenResearch[eraIndex], 2, `${m.givenResearch[eraIndex]} / 2 Research transferred`);
    case "h2-diplomatic":
      return progress(unique(m.agreementsEstablished[eraIndex]), 2);
    case "h2-balanced":
      return progress(techAt(p, 2), 3, `${techAt(p, 2)} / 3 branches at Level II`);
    case "h2-guardian": {
      const cu = totalCombatUnits(game, playerId);
      const complete = cu >= 8 && m.combatInitiated[eraIndex] === 0;
      return {
        current: complete ? 2 : Number(cu >= 8) + Number(m.combatInitiated[eraIndex] === 0),
        target: 2,
        label: `CU ${cu}/8 · Initiated combat ${m.combatInitiated[eraIndex]}`,
        complete,
      };
    }
    case "h2-burden": {
      const tribute = Number(p.eraTributes[eraIndex] >= 1);
      const given = Number(m.givenTradeResources[eraIndex] >= 2);
      return progress(tribute + given, 2, `Tribute ${tribute}/1 · Resources provided ${m.givenTradeResources[eraIndex]}/2`);
    }

    case "h3-tech":
      return progress(Number(adv.some((branch) => p.tech[branch] === 4)) + Number(p.resources.research >= 2), 2,
        `Advanced to IV this Era ${adv.some((branch) => p.tech[branch] === 4) ? "yes" : "no"} · Research ${p.resources.research}/2`);
    case "h3-builder": {
      const actions = m.builtCenters[eraIndex] + m.upgradedHabitats[eraIndex];
      const sites = new Set(m.habitatDevelopmentHexes[eraIndex]).size;
      return progress(Number(m.builtCenters[eraIndex] >= 1) + Number(m.upgradedHabitats[eraIndex] >= 1) + Number(actions >= 3) + Number(sites >= 2), 4,
        `Centers ${m.builtCenters[eraIndex]}/1 · Upgrades ${m.upgradedHabitats[eraIndex]}/1 · Actions ${actions}/3 · Habitats ${sites}/2`);
    }
    case "h3-engine":
      return progress(m.productionTotals[eraIndex], 9);
    case "h3-mobilization":
      return progress(Number(m.recruitedCU[eraIndex] >= 6) + Number(totalCombatUnits(game, playerId) >= 8), 2,
        `Recruited ${m.recruitedCU[eraIndex]}/6 · CU ${totalCombatUnits(game, playerId)}/8`);
    case "h3-conqueror":
      return progress(m.habitatsCaptured[eraIndex], 2);
    case "h3-peace": {
      const cu = totalCombatUnits(game, playerId);
      const complete = cu >= 12 && m.combatInitiated[eraIndex] === 0;
      return {
        current: complete ? 2 : Number(cu >= 12) + Number(m.combatInitiated[eraIndex] === 0),
        target: 2,
        label: `CU ${cu}/12 · Initiated combat ${m.combatInitiated[eraIndex]}`,
        complete,
      };
    }
    case "h3-broker": {
      const partners = unique(trades);
      const agreements = activeAgreements(game).filter((agreement) => agreement.parties.includes(playerId)).length;
      return progress(Number(partners >= 3) + Number(agreements >= 3) + Number(m.tradeCount[eraIndex] >= 4), 3,
        `Trade partners ${partners}/3 · Agreements ${agreements}/3 · Trades ${m.tradeCount[eraIndex]}/4`);
    }
    case "h3-supplier":
      return progress(Number(m.givenTradeResources[eraIndex] >= 6) + Number(unique(m.givenTradePartners[eraIndex]) >= 3), 2,
        `Resources provided ${m.givenTradeResources[eraIndex]}/6 · Recipients ${unique(m.givenTradePartners[eraIndex])}/3`);
    case "h3-architect": {
      const items =
        m.builtVessels[eraIndex] +
        m.builtCenters[eraIndex] +
        m.upgradedHabitats[eraIndex] +
        m.habitatsEstablished[eraIndex];
      const categories = [
        m.builtVessels[eraIndex],
        m.builtCenters[eraIndex],
        m.upgradedHabitats[eraIndex] + m.habitatsEstablished[eraIndex],
      ].filter((value) => value > 0).length;
      return progress(Number(items >= 4) + Number(categories >= 3), 2, `Actions ${items}/4 · Categories ${categories}/3`);
    }
    case "h3-leadership":
      return progress(
        Number(p.eraTributes[eraIndex] >= 1) + Number(p.tributes >= Math.max(...game.players.map((player) => player.tributes))) + Number(m.givenTradeResources[eraIndex] >= 2),
        3,
        `Era III Tribute ${p.eraTributes[eraIndex]}/1 · Total ${p.tributes}/${Math.max(...game.players.map((player) => player.tributes))} leading Tributes · Resources provided ${m.givenTradeResources[eraIndex]}/2`,
      );

    case "h4-science":
      return progress(techAt(p, 4), 2, `${techAt(p, 4)} / 2 branches at Level IV`);
    case "h4-great":
      return progress(
        Number(hs.length >= 5) + Number(hs.filter((h) => h.tier === "Metropolis").length >= 2),
        2,
        `Habitats ${hs.length}/5 · Metropolises ${hs.filter((h) => h.tier === "Metropolis").length}/2`,
      );
    case "h4-arsenal":
      return progress(totalCombatUnits(game, playerId), 12, `${totalCombatUnits(game, playerId)} / 12 CU`);
    case "h4-conquest":
      return progress(m.metropolisCaptured[eraIndex], 1);
    case "h4-partner":
      return progress(agreementPartners(game, playerId), Math.max(1, game.players.length - 3));
    case "h4-economy": {
      const held = p.resources.currency + p.resources.material + p.resources.research;
      return progress(held, 10, `${held} / 10 M+C+R`);
    }
    case "h4-expansion":
      return progress(m.habitatsEstablished[eraIndex] + m.habitatsCaptured[eraIndex], 2);
    case "h4-compromise":
      return progress(
        Number(unique(trades) >= 3) + Number(p.eraTributes[eraIndex] >= 1),
        2,
        `Trade partners ${unique(trades)}/3 · Tribute ${p.eraTributes[eraIndex]}/1`,
      );
    case "h4-savior":
      return progress(p.eraTributes[eraIndex], 2);
    case "h4-complete":
      return progress(
        Number(techAt(p, 3) >= 4) +
          Number(hs.length >= 3) +
          Number(agreementPartners(game, playerId) >= 1),
        3,
        `Level III ${techAt(p, 3)}/4 · Habitats ${hs.length}/3 · Agreements ${agreementPartners(game, playerId)}/1`,
      );
    default:
      return progress(hidden?.completed ? 1 : 0, 1, hidden?.completed ? "Marked complete" : "Table confirmation required");
  }
}

export function scoreHiddenEra(game: GameState, era: number) {
  for (const p of game.players) {
    const state = p.hiddenLegacy[era];
    if (!state?.selected || state.scored) continue;
    const card = hiddenLegacyDeck.find((c) => c.id === state.selected)!;
    const completed = card.automatic
      ? hiddenSatisfied(game, p, card)
      : !!state.completed;
    if (completed) {
      state.completed = true;
      if (game.secretHiddenScoring) state.bankedPoints = card.lp;
      else awardLegacy(game, p.id, "hidden", card.lp, card.name);
    }
    state.scored = true;
  }
  evaluateLegacy(game);
}
export function manualClaimUniversal(
  game: GameState,
  playerId: number,
  id: string,
) {
  const o = universalLegacy.find((x) => x.id === id);
  if (
    !o ||
    o.automatic ||
    !legacyObjectiveProgress(game, playerId, id).complete ||
    game.universalClaims.some((c) => c.objectiveId === id) ||
    o.era > game.era
  )
    return false;
  game.universalClaims.push({
    objectiveId: id,
    playerId,
    turn: game.turn,
    lp: o.lp,
  });
  awardLegacy(game, playerId, "universal", o.lp, o.name);
  return true;
}
export function manualClaimCivilization(
  game: GameState,
  playerId: number,
  id: string,
) {
  const p = game.players[playerId],
    o = civilizationObjectives(p).find((x) => x.id === id);
  if (!o || o.automatic || !legacyObjectiveProgress(game, playerId, id).complete || p.civilizationClaims.includes(id)) return false;
  p.civilizationClaims.push(id);
  awardLegacy(game, playerId, "civilization", o.lp, o.name);
  return true;
}

export function finalizeGame(game: GameState): GameResult {
  scoreHiddenEra(game, finalEra(game));
  if (game.secretHiddenScoring) {
    for (const player of game.players) for (const state of Object.values(player.hiddenLegacy)) {
      if (!state.bankedPoints) continue;
      const points = state.bankedPoints;
      state.bankedPoints = 0;
      awardLegacy(game, player.id, "hidden", points, hiddenLegacyDeck.find((card) => card.id === state.selected)?.name || "Hidden Objective");
    }
  }
  evaluateLegacy(game);
  const target = gateTarget(game);
  if (game.gate < target) {
    game.result = {
      gateSucceeded: false,
      winnerIds: [],
      reason: `The Horizon Gate received ${game.gate} of ${target} required Tributes. Every civilization loses.`,
      finalizedTurn: game.turn,
    };
    return game.result;
  }
  let candidates = [...game.players];
  const filters = [
    (p: PlayerState) => p.lp,
    (p: PlayerState) => p.tributes,
    (p: PlayerState) => p.legacy.universal,
    (p: PlayerState) => Object.values(p.tech).reduce((s, v) => s + v - 1, 0),
    (p: PlayerState) => habitats(game, p.id).length,
  ];
  for (const value of filters) {
    const best = Math.max(...candidates.map(value));
    candidates = candidates.filter((p) => value(p) === best);
    if (candidates.length === 1) break;
  }
  game.result = {
    gateSucceeded: true,
    winnerIds: candidates.map((p) => p.id),
    reason:
      candidates.length === 1
        ? `${candidates[0].name} wins with ${candidates[0].lp} LP.`
        : `${candidates.map((p) => p.name).join(" and ")} share victory after all tiebreakers.`,
    finalizedTurn: game.turn,
  };
  return game.result;
}
export function legacyCard(id?: string) {
  return id ? hiddenLegacyDeck.find((c) => c.id === id) : undefined;
}
export function factionName(p: PlayerState) {
  return factionLibrary[p.faction].name;
}
