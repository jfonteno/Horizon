import { factionLibrary, type FactionId } from "../factions";
import type {
  GameResult,
  GameState,
  HiddenLegacyCard,
  LegacyCategory,
  PlayerLegacyMetrics,
  PlayerState,
} from "../types";
import { activeAgreements } from "./diplomacy";
import { carrierLibrary, totalCombatUnits } from "./fleet";

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
  {
    id: "joint-venture",
    era: 2,
    name: "Joint Venture",
    lp: 4,
    condition:
      "Complete a project with contributions from at least 2 other civilizations.",
    automatic: false,
  },
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
    automatic: false,
  },
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
    condition: "Control 3 Metropolises simultaneously.",
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
    "Reach Level IV in any Technology branch.",
  ),
  H(
    "h3-builder",
    3,
    "Master Builder",
    5,
    "Control a Metropolis and construct at least 1 Center during this Era.",
  ),
  H(
    "h3-engine",
    3,
    "Economic Engine",
    5,
    "Produce at least 7 Currency, Material, Research, and Influence combined in one Production Phase.",
  ),
  H("h3-mobilization", 3, "Mobilization", 5, "Recruit 4 Combat Units during this Era."),
  H("h3-conqueror", 3, "Conqueror", 6, "Capture at least 1 enemy Habitat during this Era."),
  H(
    "h3-peace",
    3,
    "Peace Through Strength",
    5,
    "Control at least 10 CU without initiating combat during this Era.",
  ),
  H(
    "h3-broker",
    3,
    "Power Broker",
    5,
    "Trade with 3 civilizations during this Era and maintain agreements with at least 2 civilizations.",
  ),
  H(
    "h3-supplier",
    3,
    "System Supplier",
    5,
    "Provide at least 5 Material, Research, or Currency to other civilizations during this Era.",
  ),
  H(
    "h3-architect",
    3,
    "Architect",
    5,
    "Complete at least 3 construction or Habitat-development actions across at least 2 categories during this Era.",
  ),
  H(
    "h3-leadership",
    3,
    "Burden of Leadership",
    5,
    "Purchase an Era III Gate Tribute and end the Era with at least 3 personal Gate Tributes total.",
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
  ],
};

export function emptyLegacyMetrics(): PlayerLegacyMetrics {
  return {
    habitatsEstablished: [0, 0, 0, 0],
    habitatsCaptured: [0, 0, 0, 0],
    metropolisCaptured: [0, 0, 0, 0],
    revealedHexes: [0, 0, 0, 0],
    builtVessels: [0, 0, 0, 0],
    recruitedCU: [0, 0, 0, 0],
    builtCenters: [0, 0, 0, 0],
    upgradedHabitats: [0, 0, 0, 0],
    combatInitiated: [0, 0, 0, 0],
    productionTotals: [0, 0, 0, 0],
    productionTypes: [[], [], [], []],
    productionAmounts: [
      { material: 0, currency: 0, research: 0, influence: 0 },
      { material: 0, currency: 0, research: 0, influence: 0 },
      { material: 0, currency: 0, research: 0, influence: 0 },
      { material: 0, currency: 0, research: 0, influence: 0 },
    ],
    technologyAdvances: [[], [], [], []],
    tradePartners: [[], [], [], []],
    receivedTradeValue: [0, 0, 0, 0],
    givenTradeResources: [0, 0, 0, 0],
    givenResearch: [0, 0, 0, 0],
    laborTraded: [0, 0, 0, 0],
    agreementsEstablished: [[], [], [], []],
    marketCurrencyEarned: 0,
    originalHabitatsCaptured: [],
    prospectedHexes: [],
    discountedHabitats: [],
    brokeragePairs: [],
    surveySales: [],
    envoyHosts: [],
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
    case "master-discipline":
      return techAt(p, 4) >= 1;
    case "systemic-economy":
      return new Set(m.productionTypes[2]).size >= 5;
    case "architect-horizon":
      return p.eraTributes.every((v) => v >= 1);
    case "metropolis-stars":
      return hs.filter((h) => h.tier === "Metropolis").length >= 3;
    case "nexus-humanity":
      return (
        agreementPartners(game, p.id) >= 3 &&
        hs.length >= 4 &&
        techAt(p, 3) >= 3
      );
    default:
      return false;
  }
}

function civilizationSatisfied(game: GameState, p: PlayerState, id: string) {
  const hs = habitats(game, p.id),
    m = p.legacyMetrics;
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
    case "m-network":
      return agreementPartners(game, p.id, ["trade", "alliance"]) >= 3;
    case "m-broker":
      return (
        new Set(m.brokeragePairs.map((pair) => pair.split(":").pop())).size >= 3
      );
    case "m-hegemony":
      return m.marketCurrencyEarned >= 8;
    case "b-survey":
      return p.privateSurveys.length >= 6;
    case "b-frontier":
      return m.discountedHabitats.length >= 3;
    case "b-information":
      return (
        new Set(m.surveySales).size >= 3 &&
        hs.filter((h) => h.surveyedBy?.includes(p.id)).length >= 4
      );
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
    if (qualifying.length === 1) {
      awardLegacy(
        game,
        qualifying[0].id,
        "universal",
        objective.lp,
        objective.name,
      );
      game.universalClaims.push({
        objectiveId: objective.id,
        playerId: qualifying[0].id,
        turn: game.turn,
        lp: objective.lp,
      });
    }
  }
  for (const p of game.players)
    for (const objective of civilizationLegacy[p.faction].filter(
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
  if (p.hiddenLegacy[era]) return;
  const deck = hiddenLegacyDeck.filter((c) => c.era === era);
  const offset = (game.seed + playerId * 7 + era * 13) % deck.length;
  p.hiddenLegacy[era] = {
    choices: [0, 1, 2].map((i) => deck[(offset + i * 3) % deck.length].id),
  };
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
      return techAt(p, 4) >= 1;
    case "h3-builder":
      return hs.some((h) => h.tier === "Metropolis") && m.builtCenters[i] >= 1;
    case "h3-engine":
      return m.productionTotals[i] >= 7;
    case "h3-mobilization":
      return m.recruitedCU[i] >= 4;
    case "h3-conqueror":
      return m.habitatsCaptured[i] >= 1;
    case "h3-peace":
      return totalCombatUnits(game, p.id) >= 10 && m.combatInitiated[i] === 0;
    case "h3-broker":
      return unique(trades) >= 3 && agreementPartners(game, p.id) >= 2;
    case "h3-supplier":
      return m.givenTradeResources[i] >= 5;
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
      return items >= 3 && categories >= 2;
    }
    case "h3-leadership":
      return p.eraTributes[i] >= 1 && p.tributes >= 3;

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

  switch (objectiveId) {
    case "beyond-frontier": return progress(m.habitatsEstablished[0], 3);
    case "interstellar-commerce": return progress(unique(m.tradePartners[0]), 3);
    case "renaissance": return progress(techAt(p, 2), 3, `${techAt(p, 2)} / 3 branches at Level II`);
    case "hub-civilization": {
      const kinds = new Set(hs.filter((h) => h.tier !== "Outpost").map((h) => h.kind));
      return progress(kinds.size, 3, `${Math.min(kinds.size, 3)} / 3 Colony resource types`);
    }
    case "diplomatic-network": return progress(agreementPartners(game, playerId), 3);
    case "joint-venture":
    case "coalition": return progress(0, 1, "Table confirmation required");
    case "master-discipline": {
      const level = Math.max(...Object.values(p.tech));
      return progress(level, 4, `Highest branch: Level ${level} / IV`);
    }
    case "systemic-economy": return progress(new Set(m.productionTypes[2]).size, 5, `${new Set(m.productionTypes[2]).size} / 5 production types`);
    case "architect-horizon": return progress(p.eraTributes.filter((value) => value > 0).length, 4, `${p.eraTributes.filter((value) => value > 0).length} / 4 Eras contributed`);
    case "metropolis-stars": return progress(hs.filter((h) => h.tier === "Metropolis").length, 3);
    case "nexus-humanity": {
      const agreements = agreementPartners(game, playerId), branches = techAt(p, 3);
      const parts = Number(agreements >= 3) + Number(hs.length >= 4) + Number(branches >= 3);
      return progress(parts, 3, `Agreements ${agreements}/3 · Habitats ${hs.length}/4 · Level III ${branches}/3`);
    }
    case "v-mobilized": return progress(totalCombatUnits(game, playerId), 10, `${totalCombatUnits(game, playerId)} / 10 CU`);
    case "v-fleet": {
      const capacity = game.carriers.filter((carrier) => carrier.owner === playerId).reduce((sum, carrier) => sum + carrierLibrary[carrier.type].capacity, 0);
      return progress(capacity, 20, `${capacity} / 20 Capacity`);
    }
    case "v-conquest": return progress(hs.filter((h) => h.originalOwner !== undefined && h.originalOwner !== playerId).length, 2);
    case "h-network": {
      const centers = hs.reduce((sum, h) => sum + h.centers.filter((center) => center === "research").length, 0);
      return progress(centers, 3, `${centers} / 3 Research Centers`);
    }
    case "h-breadth": return progress(techAt(p, 3), 3, `${techAt(p, 3)} / 3 branches at Level III`);
    case "h-export": return progress(p.diplomacy.technologyExportPartners.length, 2);
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
    case "a-service": return progress(new Set(game.civilianUnits.filter((unit) => unit.owner === playerId && unit.type === "envoy").map((unit) => game.hexes.find((hex) => hex.id === unit.hex)?.owner).filter((owner): owner is number => owner !== undefined && owner !== playerId)).size, 2);
    case "a-web": return progress(agreementPartners(game, playerId), 3);
    case "a-influence": return progress(p.diplomacy.bonusInfluenceGained || 0, 5, `${p.diplomacy.bonusInfluenceGained || 0} / 5 bonus Influence`);
    case "m-broker": return progress(new Set(m.brokeragePairs.map((pair) => pair.split(":").pop())).size, 3);
    case "m-network": return progress(agreementPartners(game, playerId, ["trade", "alliance"]), 3);
    case "m-hegemony": return progress(m.marketCurrencyEarned, 8, `${m.marketCurrencyEarned} / 8 Currency`);
    case "b-survey": return progress(p.privateSurveys.length, 6);
    case "b-frontier": return progress(m.discountedHabitats.length, 3);
    case "b-information": {
      const sales = new Set(m.surveySales).size, controlled = hs.filter((h) => h.surveyedBy?.includes(playerId)).length;
      return progress(Number(sales >= 3) + Number(controlled >= 4), 2, `Survey buyers ${sales}/3 · Surveyed Habitats ${controlled}/4`);
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
      return progress(Math.max(...Object.values(p.tech)), 4, `Highest branch: Level ${Math.max(...Object.values(p.tech))} / IV`);
    case "h3-builder": {
      const metro = Number(hs.some((h) => h.tier === "Metropolis"));
      const center = Number(m.builtCenters[eraIndex] >= 1);
      return progress(metro + center, 2, `Metropolis ${metro}/1 · Center built ${m.builtCenters[eraIndex]}/1`);
    }
    case "h3-engine":
      return progress(m.productionTotals[eraIndex], 7);
    case "h3-mobilization":
      return progress(m.recruitedCU[eraIndex], 4, `${m.recruitedCU[eraIndex]} / 4 CU recruited`);
    case "h3-conqueror":
      return progress(m.habitatsCaptured[eraIndex], 1);
    case "h3-peace": {
      const cu = totalCombatUnits(game, playerId);
      const complete = cu >= 10 && m.combatInitiated[eraIndex] === 0;
      return {
        current: complete ? 2 : Number(cu >= 10) + Number(m.combatInitiated[eraIndex] === 0),
        target: 2,
        label: `CU ${cu}/10 · Initiated combat ${m.combatInitiated[eraIndex]}`,
        complete,
      };
    }
    case "h3-broker": {
      const partners = unique(trades);
      const agreements = agreementPartners(game, playerId);
      return progress(Number(partners >= 3) + Number(agreements >= 2), 2, `Trade partners ${partners}/3 · Agreements ${agreements}/2`);
    }
    case "h3-supplier":
      return progress(m.givenTradeResources[eraIndex], 5);
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
      return progress(Number(items >= 3) + Number(categories >= 2), 2, `Actions ${items}/3 · Categories ${categories}/2`);
    }
    case "h3-leadership":
      return progress(
        Number(p.eraTributes[eraIndex] >= 1) + Number(p.tributes >= 3),
        2,
        `Era III Tribute ${p.eraTributes[eraIndex]}/1 · Total Tributes ${p.tributes}/3`,
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
      awardLegacy(game, p.id, "hidden", card.lp, card.name);
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
    o = civilizationLegacy[p.faction].find((x) => x.id === id);
  if (!o || p.civilizationClaims.includes(id)) return false;
  p.civilizationClaims.push(id);
  awardLegacy(game, playerId, "civilization", o.lp, o.name);
  return true;
}

export function finalizeGame(game: GameState): GameResult {
  scoreHiddenEra(game, 4);
  evaluateLegacy(game);
  const target = game.players.length * 3;
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