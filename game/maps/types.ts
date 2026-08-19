import type { HexKind } from "../types";

export type MapId = "shattered-reach";
export type MapDefinition = {
  id: MapId;
  name: string;
  description: string;
  rows: number;
  columns: number;
  starts: string[];
  regions: Record<string, string>;
  blocked: Set<string>;
  tilePool: HexKind[];
};
