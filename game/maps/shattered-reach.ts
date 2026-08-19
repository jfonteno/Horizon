import type { HexKind } from "../types";
import type { MapDefinition } from "./types";

const repeat = (kind: HexKind, count: number) => Array<HexKind>(count).fill(kind);

export const shatteredReach: MapDefinition = {
  id: "shattered-reach",
  name: "Shattered Reach",
  description: "Six strategic regions divided by fractured voids, narrow routes, and shifting world resources.",
  rows: 9,
  columns: 9,
  starts: ["1-1","1-7","4-4","4-8","7-1","8-5"],
  regions: {"1-1":"Northwest Shelf","1-7":"Gulf Mouth","4-4":"Central Basin","4-8":"Eastern Corridor","7-1":"Peninsula","8-5":"Southern Cape"},
  blocked: new Set(["0-0","0-4","0-8","1-4","2-0","2-3","2-4","2-8","3-3","3-7","4-2","5-2","5-6","6-2","6-3","6-6","7-3","7-7","8-0","8-8"]),
  tilePool: [...repeat("material",6),...repeat("currency",6),...repeat("research",6),...repeat("influence",6),...repeat("labor",6),...repeat("barren",9),...repeat("anomaly",7)]
};
