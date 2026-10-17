import type { FactionDefinition } from "./types";

export const wayfarers: FactionDefinition = {
  id: "wayfarers", name: "The Wayfarers", role: "Nomads", color: "#e2a451", logo: "/factions/wayfarers.png", homeProduction: "research",
  rulesProfile: "wayfarers", sourcePack: "shattered-reach-expansion", sourcePackVersion: "0.33.3",
  blurb: "A mobile civilization whose Arkships carry settlement infrastructure across the Reach.",
  lore: ["Wayfarer cities travel with their people. Arkships and their larger successors carry Centers across the system, turning migration routes into a network of temporary production sites.", "They begin with an Arkship in place of the usual Colony Ship. A deployed mobile Habitat can extract a resource from the world it occupies, while escorts and Caravan Guards keep the settlement fleet together."],
  abilities: [
    { name: "Mobile Habitats", unlock: "Resource II–IV", summary: "Build Arkships, Grand Arks, and a single Worldship, then relocate them with Migration Orders." },
    { name: "Mobile Extraction", summary: "Each deployed Arkship, Grand Ark, and Worldship produces 1 matching resource from the Material, Currency, Research, or Influence world it occupies." },
    { name: "Deep Recon", unlock: "Exploration II", summary: "Once per Turn, privately inspect one adjacent unrevealed hex." },
    { name: "Escort Doctrine", unlock: "Military II", summary: "Escorted mobile Habitats survive tied defensive combat." },
    { name: "Caravan Defense", summary: "Attach Caravan Guards or field Gunnery Platforms that rise to 6 CS while defending a caravan." },
  ],
  objectives: ["Arkship Voyage", "The Caravan", "Wandering Civilization", "The Great Exodus", "Civilization in Motion", "A People Beyond Reach"],
  starting: { resources: { material: 1, currency: 1, influence: 2 }, homeCenter: "research" },
};
