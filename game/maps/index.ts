import { shatteredReach } from "./shattered-reach";
import type { MapDefinition, MapId } from "./types";
export const mapLibrary: Record<MapId, MapDefinition> = { "shattered-reach": shatteredReach };
export type { MapDefinition, MapId } from "./types";
