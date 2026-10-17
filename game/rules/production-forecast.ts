import { factionLibrary, factionRules } from "../factions";
import type { GameState, Resource } from "../types";
import { mobileHabitatExtractionResource, mobileHabitatLibrary } from "./shattered-reach";

export type ProductionSource = { hexId: string; label: string; resource: Resource | "labor"; amount: number };

/** Mirrors the recurring, deterministic part of the production phase. No proposed trade is guaranteed. */
export function productionForecast(game: GameState, playerId: number) {
  const player = game.players[playerId];
  const multiplier = player.tech.Resource >= 4 ? 2 : 1;
  const sources: ProductionSource[] = [];
  const add = (hexId: string, label: string, resource: Resource | "labor", amount: number) => {
    if (amount > 0) sources.push({ hexId, label, resource, amount });
  };
  const home = game.hexes.find((hex) => hex.originalOwner === playerId && hex.kind === "home");
  const defaultHome = factionLibrary[player.faction].homeProduction;
  const allowed = factionRules(player) === "varkesh" ? ["material", "currency"] : factionRules(player) === "farbound" ? ["research", "currency"] : factionRules(player) === "helix" ? ["research", "material", "currency"] : [defaultHome];
  const homeResource = allowed.includes(player.homeProductionChoice as Resource) ? player.homeProductionChoice! : defaultHome;
  add(home?.id || "home", "Homeworld", homeResource, multiplier);
  for (const hex of game.hexes.filter((item) => item.owner === playerId)) {
    if (["material", "currency", "research", "influence", "labor"].includes(hex.kind))
      add(hex.id, `${hex.kind} world`, hex.kind as Resource | "labor", multiplier);
    hex.centers.forEach((center, index) => {
      if (["material", "currency", "research", "influence", "labor"].includes(center)) {
        add(hex.id, `${hex.enhancedCenterIndices?.includes(index) ? "Enhanced " : ""}${center} Center`, center as Resource | "labor", multiplier);
        if (hex.enhancedCenterIndices?.includes(index) && center !== "labor") add(hex.id, `${center} Center enhancement`, center as Resource, 1);
      } else if (center === "factory") add(hex.id, "Factory", hex.factoryOutputs?.[index] || "material", multiplier);
    });
  }
  for (const mobile of game.mobileHabitats.filter((item) => item.owner === playerId && item.deployed)) {
    const name = mobileHabitatLibrary[mobile.type].name;
    const extraction = mobileHabitatExtractionResource(game, mobile);
    if (extraction) add(mobile.hex, `${name} extraction`, extraction, 1);
    for (const center of mobile.centers) if (["material", "currency", "research", "influence"].includes(center))
      add(mobile.hex, `${name} ${center} Center`, center as Resource, multiplier);
  }
  const totals = { material: 0, currency: 0, research: 0, influence: 0, labor: 0 };
  for (const source of sources) totals[source.resource] += source.amount;
  const laborCap = Math.max(1, 3 + player.laborBonus + totals.labor - (player.laborPenalty || 0));
  return { sources, totals, laborCap };
}
