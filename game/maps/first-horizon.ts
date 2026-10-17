import type { MapDefinition } from "./types";

const blocked = new Set<string>([
  "0-0", "0-4", "1-0", "1-4", "3-0", "3-4", "4-0", "4-4",
]);

/** A compact, deterministic teaching system used only by First Horizon. */
export const firstHorizonMap: MapDefinition = {
  id: "first-horizon",
  name: "First Horizon",
  description: "A compact teaching system with fixed discoveries and three close civilizations.",
  rows: 5,
  columns: 5,
  starts: ["2-0", "0-2", "4-2"],
  startsByPlayerCount: { 3: ["2-0", "0-2", "4-2"] },
  regions: {
    "2-0": "Foundry Anchorage",
    "0-2": "Helix Observatory",
    "4-2": "Varkesh Muster",
  },
  blocked,
  tilePool: [],
  fixedTiles: {
    "0-1": "research", "0-3": "influence",
    "1-1": "material", "1-2": "anomaly", "1-3": "currency",
    "2-1": "currency", "2-2": "labor", "2-3": "barren", "2-4": "material",
    "3-1": "research", "3-2": "material", "3-3": "influence",
    "4-1": "barren", "4-3": "currency",
  },
  randomizeStarts: false,
  tutorialOnly: true,
  minPlayers: 3,
  maxPlayers: 3,
};
