import type { CenterType, PlayerState, Resource, TechnologyBranch } from "../types";

export type FactionId = string;
export type CoreFactionRules = "standard" | "varkesh" | "helix" | "foundry" | "aurelians" | "meridian" | "farbound";

export type FactionStartingPackage = {
  resources?: Partial<Record<Resource, number>>;
  technology?: Partial<Record<TechnologyBranch, number>>;
  laborCap?: number;
  homeCenter?: CenterType;
};

export type FactionDefinition = {
  id: FactionId;
  name: string;
  role: string;
  color: string;
  blurb: string;
  lore?: string[];
  abilities?: Array<{
    name: string;
    summary: string;
    unlock?: string;
  }>;
  homeProduction: Resource;
  objectives: [string, string, string];
  starting?: FactionStartingPackage;
  rulesProfile?: CoreFactionRules;
  logo?: string;
  sourcePack?: string;
  sourcePackVersion?: string;
  initialize?(player: PlayerState): void;
};
