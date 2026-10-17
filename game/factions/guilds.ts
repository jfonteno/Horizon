import type { FactionDefinition } from "./types";

export const guilds: FactionDefinition = {
  id: "guilds", name: "The Guilds", role: "Specialists", color: "#d5bd57", logo: "/factions/guilds.png", homeProduction: "currency",
  rulesProfile: "guilds", sourcePack: "shattered-reach-expansion", sourcePackVersion: "0.33.3",
  blurb: "Master builders who trade permanent Labor capacity for exceptional economic Centers.",
  lore: ["The Guilds turn specialization into civic power. Workshops, enhanced Centers, and programmable Factories let them adapt an established economy to changing shortages.", "They begin with an Enhanced Currency Center, but each further enhancement costs permanent Labor Capacity. Their strongest turns come from choosing which production lines truly deserve that commitment."],
  abilities: [
    { name: "Enhanced Centers", summary: "Enhance a non-Labor economic Center for 3 Material, 3 Currency, and 2 Research. Each enhancement permanently reduces Labor Capacity by 1." },
    { name: "Precision Construction", summary: "The first Center constructed each Era costs 1 less Currency." },
    { name: "Factory", unlock: "Economy III", summary: "Build a Factory that produces a chosen Material, Currency, or Research each Production." },
  ],
  objectives: ["Specialized Economy", "Masterworks", "Engine of Prosperity", "Advanced Masterworks", "Civilization of Masters"],
  starting: { resources: { material: 1, currency: 1 }, homeCenter: "currency" },
};
