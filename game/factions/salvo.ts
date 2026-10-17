import type { FactionDefinition } from "./types";

export const salvo: FactionDefinition = {
  id: "salvo", name: "The Salvo", role: "Artillery", color: "#ef725e", logo: "/factions/salvo.png", homeProduction: "material",
  rulesProfile: "salvo", sourcePack: "shattered-reach-expansion", sourcePackVersion: "0.33.3",
  blurb: "Long-range fire specialists who weaken opposing forces before normal combat begins.",
  lore: ["Salvo doctrine treats a battle as a problem of position and timing. Artillery vessels threaten occupied hexes before direct combat, rewarding reconnaissance and protected firing lanes.", "The faction begins with a Bombard Frigate instead of a standard Patrol. It can move or prepare a stronger stationary shot, so each turn asks whether to reposition or commit to fire."],
  abilities: [
    { name: "Bombardment", unlock: "Military II", summary: "Bombardment range is 1 at Military I, 2 at II, 4 at III, and 7 at IV. Targets beyond 4 require a friendly spotter near the target. Bombardment cannot destroy the final Combat Unit. Bombard Frigates move 3 hexes before Military bonuses." },
    { name: "Siege Tender", unlock: "Military IV", summary: "Once per Turn, extend one nearby Bombardment by 1 hex without increasing damage." },
    { name: "Light Defenses", summary: "Salvo Defense Grids provide 2 Home Guard instead of 3." },
  ],
  objectives: ["Fire Mission", "Gun for Hire", "Fire Superiority", "Artillery Network", "Dominion by Fire"],
  starting: { resources: { material: 1, currency: 1 }, homeCenter: "material" },
};
