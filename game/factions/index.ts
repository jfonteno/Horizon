import { aurelians } from "./aurelians";
import { farbound } from "./farbound";
import { foundry } from "./foundry";
import { helix } from "./helix";
import { meridian } from "./meridian";
import type { FactionDefinition, FactionId } from "./types";
import { varkesh } from "./varkesh";

export const factionLibrary: Record<FactionId, FactionDefinition> = { varkesh, helix, foundry, aurelians, meridian, farbound };
export const factionIds = Object.keys(factionLibrary) as FactionId[];
export type { FactionDefinition, FactionId } from "./types";
