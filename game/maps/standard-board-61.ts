import type { HexKind } from "../types";
import type { MapDefinition } from "./types";

const repeat = (kind: HexKind, count: number) => Array<HexKind>(count).fill(kind);
const blocked = new Set<string>();
for (let row = 0; row < 9; row++)
  for (let col = 0; col < 9; col++)
    if (Math.abs(row - col) > 4) blocked.add(`${row}-${col}`);

/** Retained only so existing 0.20.0 rooms keep their original geometry. */
export const standardBoard61: MapDefinition = {
  id: "standard-board-61",
  name: "Standard Board (61-hex legacy)",
  description: "The former side-5 Standard Board, retained for saved-game compatibility.",
  rows: 9,
  columns: 9,
  starts: ["1-4", "1-5", "4-1", "4-7", "7-4", "7-5"],
  startsByPlayerCount: {
    4: ["1-4", "4-7", "7-4", "4-1"],
    5: ["1-4", "1-5", "4-7", "7-5", "4-1"],
    6: ["1-4", "1-5", "4-7", "7-5", "7-4", "4-1"],
  },
  regions: {},
  blocked,
  tilePool: [
    ...repeat("material", 5), ...repeat("currency", 5),
    ...repeat("research", 5), ...repeat("influence", 5),
    ...repeat("labor", 5), ...repeat("barren", 8),
    ...repeat("anomaly", 5), ...repeat("empty", 17),
  ],
  minPlayers: 4,
  maxPlayers: 6,
};
