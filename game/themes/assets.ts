import type { CarrierType, CivilianUnitType, HexKind } from "../types";
import type { MapDefinition } from "../maps";

export const tileAssets: Record<HexKind | "unrevealed", string> = {
  material: "/tiles/tile-material.webp",
  currency: "/tiles/tile-currency.webp",
  research: "/tiles/tile-research.webp",
  influence: "/tiles/tile-influence.webp",
  labor: "/tiles/tile-labor.webp",
  barren: "/tiles/tile-barren.webp",
  anomaly: "/tiles/tile-anomaly.webp",
  hazard: "/tiles/tile-hazard.webp",
  empty: "/tiles/tile-empty.webp",
  home: "/tiles/tile-homeworld.webp",
  rift: "/tiles/tile-rift.webp",
  unrevealed: "/tiles/tile-unrevealed.webp",
};

export type ExplorationShipIcon =
  | "explorer"
  | "surveyVessel"
  | "deepSurvey"
  | "pathfinder";

export type ShipIconType =
  | CarrierType
  | CivilianUnitType
  | ExplorationShipIcon
  | "arkship"
  | "grandArk"
  | "worldship"
  | "blockade"
  | "colonyShip";

export function explorationIcon(level: number): ExplorationShipIcon {
  if (level >= 4) return "pathfinder";
  if (level >= 3) return "deepSurvey";
  if (level >= 2) return "surveyVessel";
  return "explorer";
}

export function tileAssetFor(map: MapDefinition, kind: HexKind, revealed = true) {
  const key = revealed ? kind : "unrevealed";
  return map.tileAssets?.[key] || tileAssets[key];
}
