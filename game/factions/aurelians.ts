import type { FactionDefinition } from "./types";

export const aurelians: FactionDefinition = {
  id: "aurelians", name: "The Aurelians", role: "Diplomatic", color: "#b38cff", logo: "/factions/aurelians.png", homeProduction: "influence",
  blurb: "Influence specialists who begin at Policy II and thrive on formal agreements.",
  lore: [
    "The Aurelians survived their world's fractured age by building institutions that could outlast individual rulers. Their envoys carry the authority of a civilization trained to turn negotiation, ceremony, and mutual obligation into practical instruments of statecraft.",
    "Aurelian power grows through relationships rather than isolation. Every durable partnership expands their political reach, while their reserves of Influence can be converted into the resources or administrative capacity needed at a decisive moment.",
  ],
  abilities: [
    { name: "Diplomatic Foundation", summary: "Begin at Policy II with 3 Influence and an Influence-producing Homeworld." },
    { name: "Web of Relations", summary: "Gain 1 Influence the first time you establish a formal agreement with each other civilization." },
    { name: "Political Capital", unlock: "Policy II", summary: "Spend 2 Influence for 1 Material or Currency, or spend 4 Influence once per Era for 1 permanent Labor Capacity." },
    { name: "Envoy", unlock: "Exploration II", summary: "Construct an Envoy that may enter a foreign Habitat with permission. A direct trade hosted there gives the Aurelians 1 Influence." },
  ],
  objectives: ["Foreign Service: Envoys with 2 rivals", "Diplomatic Web: 3 agreements", "Influence Network: 5 bonus Influence"],
  initialize(player) { player.resources.influence = 3; player.tech.Policy = 2; },
};
