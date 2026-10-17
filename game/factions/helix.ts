import type { FactionDefinition } from "./types";

export const helix: FactionDefinition = {
  id: "helix", name: "The Helix", role: "Science", color: "#69c8ff", logo: "/factions/helix.png", homeProduction: "research",
  blurb: "Research-efficient technology leaders with inexpensive Research Centers.",
  lore: [
    "The Helix is a civilization of academies, laboratories, and interlocking research directorates. Its people regard knowledge as infrastructure: something that must be cultivated, tested, and shared carefully enough to lift an entire civilization without surrendering strategic advantage.",
    "Helix leaders rarely dominate through raw production or military mass. Instead, they compress decades of development into a few critical breakthroughs, then use technological exchange to shape their neighbors and make themselves indispensable to the system's future.",
  ],
  abilities: [
    { name: "Accelerated Research", summary: "Every normal Technology advance costs 1 less Research, but never less than 1 Research." },
    { name: "Research Infrastructure", summary: "Research Centers cost only 1 Material, 1 Currency, and 1 Labor." },
    { name: "Technology Exchange", summary: "Offer a Technology level you possess to a civilization that owns the immediately preceding level. The buyer pays reduced Research plus negotiated compensation." },
    { name: "Scientific Foundation", summary: "Begin with 1 Material, 2 Research, and a Research-producing Homeworld." },
    { name: "Research Reallocation", summary: "During Orders, choose Research, Material, or Currency for your Homeworld's next Production. This replaces its normal Research output for that Production; the choice persists until changed." },
  ],
  objectives: ["Research Network: 3 Research Centers", "Technological Breadth: 3 branches at III", "Knowledge Exporter: sell technology twice"],
  initialize(player) { player.resources.material = 1; player.resources.research = 2; },
};
