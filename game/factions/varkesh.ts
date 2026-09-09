import type { FactionDefinition } from "./types";

export const varkesh: FactionDefinition = {
  id: "varkesh", name: "The Varkesh", role: "Military", color: "#dc6b35", logo: "/factions/varkesh.png", homeProduction: "material",
  blurb: "Cheaper fleets, rapid force projection, and Glory earned through decisive battle.",
  lore: [
    "The Varkesh emerged from worlds where survival depended on discipline, preparation, and the ability to answer danger before it reached the population centers. Their civilization is organized around expeditionary fleets and a martial tradition that treats command as both a public duty and a path to honor.",
    "They do not seek conflict without purpose, but they believe peace belongs to the civilization capable of defending it. Varkesh admirals prefer fast deployments, decisive engagements, and captured infrastructure that can be turned immediately toward the defense of the system.",
  ],
  abilities: [
    { name: "Efficient Ship Frames", summary: "Standard military vessels cost 1 less Material, to a minimum cost of 1 Material." },
    { name: "Glory in Battle", summary: "The first victory against each opposing civilization in a Turn awards Legacy Points equal to the current Era." },
    { name: "Conquest Doctrine", summary: "Habitats captured by the Varkesh do not lose a tier. Excess Centers must still be resolved normally." },
    { name: "Flexible Homeworld Industry", summary: "Choose Material or Currency as the Homeworld's next Production output." },
    { name: "Corvette", unlock: "Military II", summary: "Unlock a fast, low-capacity rapid-response military vessel." },
    { name: "Xebec", unlock: "Military IV", summary: "Unlock a fast military vessel capable of carrying up to 12 Combat Units." },
  ],
  objectives: ["Mobilized Society: 10 CU", "Fleet Doctrine: 20 vessel capacity", "Conquering Power: 2 captured Habitats"],
  initialize(player) { player.resources.material = 1; player.resources.currency = 1; },
};
