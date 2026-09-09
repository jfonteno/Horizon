import type { HexKind } from "../types";
import type { MapDefinition } from "./types";

const repeat = (kind: HexKind, count: number) => Array<HexKind>(count).fill(kind);
const blocked = new Set<string>();
const radius = 5;
for (let row = 0; row < 11; row++)
  for (let col = 0; col < 11; col++) {
    const q = col - radius;
    const r = row - radius - (q - (q & 1)) / 2;
    if (Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)) > radius)
      blocked.add(`${row}-${col}`);
  }

export const standardBoard: MapDefinition = {
  id: "standard-board",
  name: "Standard Board",
  description: "The canonical symmetric side-6 board with 91 playable hexes. Hazard tiles are replaced by Empty Space.",
  rows: 11,
  columns: 11,
  starts: ["1-5", "3-9", "7-9", "9-5", "7-1", "3-1"],
  startsByPlayerCount: {
    4: ["1-5", "5-9", "9-5", "5-1"],
    5: ["1-5", "3-9", "7-9", "9-5", "5-1"],
    6: ["1-5", "3-9", "7-9", "9-5", "7-1", "3-1"],
  },
  regions: {},
  blocked,
  tilePool: [
    ...repeat("material", 8),
    ...repeat("currency", 8),
    ...repeat("research", 8),
    ...repeat("influence", 8),
    ...repeat("labor", 8),
    ...repeat("barren", 12),
    ...repeat("anomaly", 8),
    ...repeat("empty", 25),
  ],
  minPlayers: 4,
  maxPlayers: 6,
};
