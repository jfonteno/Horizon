import { shatteredReach } from "./shattered-reach";
import { standardBoard } from "./standard-board";
import { standardBoard61 } from "./standard-board-61";
import { standardBoard91 } from "./standard-board-91";
import { shatteredReachLegacy } from "./shattered-reach-legacy";
import { firstHorizonMap } from "./first-horizon";
import type { MapDefinition, MapId, PortableMapDefinition } from "./types";

const coreMapIds = new Set([shatteredReach.id, standardBoard.id, standardBoard61.id, standardBoard91.id, shatteredReachLegacy.id, firstHorizonMap.id]);
export const mapLibrary: Record<MapId, MapDefinition> = {
  "standard-board": standardBoard,
  "standard-board-61": standardBoard61,
  "standard-board-91": standardBoard91,
  "shattered-reach": shatteredReach,
  "shattered-reach-legacy": shatteredReachLegacy,
  "first-horizon": firstHorizonMap,
};
export const mapIds: MapId[] = [standardBoard.id, shatteredReach.id];

export function registerMap(definition: MapDefinition | PortableMapDefinition) {
  const hydrated: MapDefinition = {
    ...definition,
    blocked: definition.blocked instanceof Set ? definition.blocked : new Set(definition.blocked),
  };
  mapLibrary[hydrated.id] = hydrated;
  if (!mapIds.includes(hydrated.id)) mapIds.push(hydrated.id);
  return hydrated;
}

export function clearExternalMaps() {
  for (const id of [...mapIds]) {
    if (coreMapIds.has(id)) continue;
    delete mapLibrary[id];
    mapIds.splice(mapIds.indexOf(id), 1);
  }
}

export type { MapDefinition, MapId, PortableMapDefinition } from "./types";
