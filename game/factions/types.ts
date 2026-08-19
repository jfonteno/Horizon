import type { PlayerState, Resource } from "../types";

export type FactionId = "varkesh" | "helix" | "foundry" | "aurelians" | "meridian" | "farbound";

export type FactionDefinition = {
  id: FactionId;
  name: string;
  role: string;
  color: string;
  blurb: string;
  homeProduction: Resource;
  objectives: [string, string, string];
  initialize(player: PlayerState): void;
};
