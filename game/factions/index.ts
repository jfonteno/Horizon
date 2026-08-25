import { aurelians } from "./aurelians";
import { farbound } from "./farbound";
import { foundry } from "./foundry";
import { helix } from "./helix";
import { meridian } from "./meridian";
import type { FactionDefinition, FactionId } from "./types";
import { varkesh } from "./varkesh";

export const factionLibrary: Record<FactionId, FactionDefinition> = { varkesh, helix, foundry, aurelians, meridian, farbound };
export const factionIds = Object.keys(factionLibrary) as FactionId[];
const coreFactionIds = new Set(factionIds);

export function registerFaction(definition: FactionDefinition) {
  factionLibrary[definition.id] = definition;
  if (!factionIds.includes(definition.id)) factionIds.push(definition.id);
  return definition;
}

export function clearExternalFactions() {
  for (const id of [...factionIds]) {
    if (coreFactionIds.has(id)) continue;
    delete factionLibrary[id];
    factionIds.splice(factionIds.indexOf(id), 1);
  }
}

export function factionRules(player: { faction: FactionId; rulesProfile?: string }) {
  return player.rulesProfile || factionLibrary[player.faction]?.rulesProfile || player.faction;
}

export type { CoreFactionRules, FactionDefinition, FactionId, FactionStartingPackage } from "./types";
