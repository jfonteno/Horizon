import type { HexKind } from "../types";
import type { MapDefinition } from "./types";

const repeat = (kind: HexKind, count: number) => Array<HexKind>(count).fill(kind);
const blocked = new Set<string>();
const radius = 4;
for (let row = 0; row < 9; row++)
  for (let col = 0; col < 9; col++) {
    const q = col - radius;
    const r = row - radius - (q - (q & 1)) / 2;
    if (Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)) > radius)
      blocked.add(`${row}-${col}`);
  }

export const standardBoard: MapDefinition = {
  id: "standard-board",
  name: "Standard Board",
  description: "A compact, symmetric side-5 hexagon with 61 playable sectors and no internal voids.",
  rows: 9,
  columns: 9,
  starts: ["1-4", "2-7", "5-7", "7-4", "5-1", "2-1"],
  startsByPlayerCount: {
    4: ["1-4", "5-7", "7-4", "2-1"],
    5: ["1-4", "2-7", "5-7", "7-4", "2-1"],
    6: ["1-4", "2-7", "5-7", "7-4", "5-1", "2-1"],
  },
  regions: {},
  blocked,
  tilePool: [
    ...repeat("material", 5),
    ...repeat("currency", 5),
    ...repeat("research", 5),
    ...repeat("influence", 5),
    ...repeat("labor", 5),
    ...repeat("barren", 8),
    ...repeat("anomaly", 5),
    ...repeat("empty", 17),
  ],
  minPlayers: 4,
  maxPlayers: 6,
};
