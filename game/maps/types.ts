import type { HexKind } from "../types";

export type MapId = string;
export type MapDefinition = {
  id: MapId;
  name: string;
  description: string;
  rows: number;
  columns: number;
  starts: string[];
  startsByPlayerCount?: Partial<Record<number, string[]>>;
  regions: Record<string, string>;
  blocked: Set<string>;
  tilePool: HexKind[];
  minPlayers?: number;
  maxPlayers?: number;
  tileAssets?: Partial<Record<HexKind | "unrevealed", string>>;
  sourcePack?: string;
  sourcePackVersion?: string;
};

export type PortableMapDefinition = Omit<MapDefinition, "blocked"> & {
  blocked: string[];
};
