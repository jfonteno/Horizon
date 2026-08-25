import { shatteredReach } from "./shattered-reach";
import type { MapDefinition, MapId, PortableMapDefinition } from "./types";

const coreMapIds = new Set([shatteredReach.id]);
export const mapLibrary: Record<MapId, MapDefinition> = { "shattered-reach": shatteredReach };
export const mapIds: MapId[] = [shatteredReach.id];

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
