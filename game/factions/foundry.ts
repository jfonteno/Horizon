import type { FactionDefinition } from "./types";

export const foundry: FactionDefinition = {
  id: "foundry", name: "The Foundry", role: "Industrial", color: "#d0a34c", logo: "/factions/foundry.png", homeProduction: "material",
  blurb: "Material-rich expansionists with prefabricated Habitats and Prospectors.",
  lore: [
    "The Foundry began as a network of orbital workshops whose crews learned to turn scarcity into a repeatable engineering problem. Over generations, those workshops became a civilization of guilds, fabrication clans, and mobile construction fleets capable of making permanent settlements where others see only unusable rock.",
    "Foundry strategy rewards patient expansion. Its industrial base reduces the Labor burden of colonization, while specialized Prospectors transform overlooked worlds into the raw material needed for the next wave of construction.",
  ],
  abilities: [
    { name: "Prefabricated Habitats", summary: "Habitat Modules cost no Labor, allowing expansion while Labor remains committed elsewhere." },
    { name: "Industrial Homeworld", summary: "Begin with 2 Material and a Material Center already installed on the Homeworld." },
    { name: "Prospector", unlock: "Exploration II", summary: "Construct a specialized vessel that can prospect an eligible unclaimed world for 1 Material. Each hex can be prospected only once." },
    { name: "Material Economy", summary: "The Homeworld produces Material, reinforcing construction and fleet development." },
  ],
  objectives: ["Material Engine: produce 4 Material", "Prospector Network: prospect 4 hexes", "Industrial Base: 5 Centers across 3 Habitats"],
  initialize(player) { player.resources.material = 2; },
};
