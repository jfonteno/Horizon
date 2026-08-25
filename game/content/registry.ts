import { clearExternalFactions, registerFaction } from "../factions";
import { clearExternalMaps, registerMap } from "../maps";
import type { ContentCatalog } from "./types";

export function installContentCatalog(catalog: ContentCatalog) {
  clearExternalMaps();
  clearExternalFactions();
  for (const map of catalog.maps) registerMap(map);
  for (const faction of catalog.factions) registerFaction(faction);
  return catalog;
}
