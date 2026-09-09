import type { FactionDefinition } from "./types";

export const farbound: FactionDefinition = {
  id: "farbound", name: "The Farbound", role: "Exploration", color: "#e48db8", logo: "/factions/farbound.png", homeProduction: "research",
  blurb: "Surveyors who privately read the frontier and settle discovered worlds efficiently.",
  lore: [
    "The Farbound descend from generations of deep-range navigators who treated the unknown not as a boundary, but as a source of identity. Their charts are family histories, commercial assets, and strategic secrets, refined through a culture that prizes curiosity tempered by careful observation.",
    "Farbound players thrive when the map remains uncertain. They can gather private information before others commit, sell that knowledge through diplomatic channels, and turn surveyed worlds into efficient new Habitats along the frontier.",
  ],
  abilities: [
    { name: "Flexible Homeworld Research", summary: "Choose Research or Currency as the Homeworld's next Production output." },
    { name: "Discovery Dividend", summary: "Publicly revealing an Anomaly grants 2 Research, Empty Space grants 1 Influence, and a Barren world grants 1 Material." },
    { name: "Forward Scan", summary: "Once per Turn, privately identify one adjacent unrevealed hex without publicly revealing it." },
    { name: "Survey Exchange", unlock: "Policy II", summary: "Sell eligible private survey information to another civilization for an agreed Currency price." },
    { name: "Long-Range Surveyor", unlock: "Exploration II", summary: "Construct a vessel that can privately survey any unrevealed hex during Orders." },
    { name: "Surveyed Settlement", summary: "Establishing a Habitat on a world you surveyed grants 1 Material and 1 Currency, plus a once-per-Era Labor refund." },
    { name: "Frontier Legacy", unlock: "Exploration IV", summary: "The first qualifying surveyed Habitat established each Era awards 2 Legacy Points." },
  ],
  objectives: ["Survey Network: survey 6 hexes", "Frontier Civilization: 3 discounted Habitats", "Information Economy: sell surveys to 3 rivals"],
  initialize(player) { player.resources.research = 1; player.resources.currency = 1; },
};
