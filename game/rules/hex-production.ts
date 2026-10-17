import { factionLibrary, factionRules } from "../factions";
import type { GameState, HexState, Resource } from "../types";
import { mobileHabitatExtractionResource, mobileHabitatLibrary } from "./shattered-reach";

export function hexProduction(game: GameState, hex: HexState): string {
  if (!hex.revealed) return "Unrevealed: production unknown";
  const summaries: string[] = [];
  if (hex.owner !== undefined && hex.tier) {
    const player = game.players[hex.owner];
    const multiplier = player.tech.Resource >= 4 ? 2 : 1;
    const output: Record<string, number> = {};
    const add = (kind: string) => { output[kind] = (output[kind] || 0) + multiplier; };
    if (hex.kind === "home" && hex.originalOwner === player.id) {
      const fallback = factionLibrary[player.faction].homeProduction;
      const profile = factionRules(player);
      const allowed = profile === "varkesh" ? ["material", "currency"] : profile === "farbound" ? ["research", "currency"] : profile === "helix" ? ["research", "material", "currency"] : [fallback];
      add(allowed.includes(player.homeProductionChoice as Resource) ? player.homeProductionChoice! : fallback);
    }
    if (["material", "currency", "research", "influence", "labor"].includes(hex.kind)) add(hex.kind);
    for (const center of hex.centers) if (center !== "defense") add(center);
    const staticSummary = Object.entries(output).map(([kind, count]) => `${count} ${kind === "labor" ? "Labor Capacity" : kind} per Turn`).join(" · ");
    if (staticSummary) summaries.push(staticSummary);
  }
  for (const mobile of game.mobileHabitats.filter((candidate) => candidate.hex === hex.id && candidate.deployed)) {
    const mobileOutput: Record<string, number> = {};
    const extractionResource = mobileHabitatExtractionResource(game, mobile);
    if (extractionResource) mobileOutput[extractionResource] = 1;
    const multiplier = game.players[mobile.owner].tech.Resource >= 4 ? 2 : 1;
    for (const center of mobile.centers) if (["material", "currency", "research", "influence"].includes(center))
      mobileOutput[center] = (mobileOutput[center] || 0) + multiplier;
    const details = Object.entries(mobileOutput).map(([kind, count]) => `${count} ${kind}`).join(" + ");
    if (details) summaries.push(`${mobileHabitatLibrary[mobile.type].name}: ${details} per Turn`);
  }
  return summaries.join(" · ") || (hex.owner === undefined || !hex.tier
    ? "No current production: establish a Habitat or deploy a Wayfarer mobile Habitat on an eligible resource world"
    : "No economic production");
}
