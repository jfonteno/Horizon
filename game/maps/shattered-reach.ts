import type { HexKind } from "../types";
import type { MapDefinition } from "./types";

const repeat = (kind: HexKind, count: number) => Array<HexKind>(count).fill(kind);

export const shatteredReach: MapDefinition = {
  id: "shattered-reach",
  name: "Shattered Reach",
  description: "Sixty-one sectors divided by four deep void gulfs, narrow approaches, and contested central routes.",
  rows: 9,
  columns: 9,
  starts: ["1-2", "1-6", "4-0", "4-8", "7-2", "7-6"],
  startsByPlayerCount: {
    4: ["1-2", "4-8", "7-6", "4-0"],
    5: ["1-2", "1-6", "4-8", "7-6", "4-0"],
    6: ["1-2", "1-6", "4-0", "4-8", "7-2", "7-6"],
  },
  regions: {"1-2":"Northwest Shelf","1-6":"Northeast Shelf","4-0":"Western Narrows","4-8":"Eastern Narrows","7-2":"Southwest Shelf","7-6":"Southeast Shelf"},
  blocked: new Set([
    "0-0", "0-4", "0-8", "1-0", "1-4", "1-8", "2-4",
    "3-0", "3-1", "4-1", "4-7", "5-7", "5-8", "6-4",
    "7-0", "7-4", "7-8", "8-0", "8-4", "8-8",
  ]),
  tilePool: [...repeat("material",6),...repeat("currency",6),...repeat("research",6),...repeat("influence",6),...repeat("labor",6),...repeat("barren",9),...repeat("anomaly",7)]
};
