import type { FactionDefinition } from "./types";

export const spires: FactionDefinition = {
  id: "spires", name: "The Spires", role: "Urbanists", color: "#a77cff", logo: "/factions/spires.png", homeProduction: "currency",
  rulesProfile: "spires", sourcePack: "shattered-reach-expansion", sourcePackVersion: "0.33.3",
  blurb: "Dense city-builders who turn a small footprint into fortified Arcologies.",
  lore: ["The Spires measure prosperity in layers: crowded towers, shared utilities, and neighborhoods that grow upward when land runs short. They invest heavily in a few Habitats and expect each to become a self-sufficient city.", "Their compact territory makes every Habitat valuable. Defense Grids protect their urban core while Resource III opens the direct path from Colony to Arcology."],
  abilities: [
    { name: "Urban Planning", summary: "Habitat upgrades cost 1 less Currency, to a minimum of 0." },
    { name: "Spires Defense Grid", summary: "Defense Grids provide fixed Home Guard strength that improves with Military Technology." },
    { name: "Arcology", unlock: "Resource III", summary: "Upgrade a Colony directly into a four-slot Arcology for 4 Material, 3 Currency, and 3 Labor." },
  ],
  objectives: ["Urban Core", "Fortified Cities", "Arcology Civilization", "Vertical Civilization", "Cities Without Horizon"],
  starting: { resources: { material: 1, currency: 1 }, homeCenter: "currency" },
};
