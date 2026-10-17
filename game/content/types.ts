import type { FactionDefinition } from "../factions/types";
import type { PortableMapDefinition } from "../maps/types";

export const CONTENT_SCHEMA_VERSION = 1;

export type ContentPackManifest = {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  horizonVersion: "0.17";
  description?: string;
  coverArt?: string;
  modules?: string[];
  dependencies?: { id: string; version: string }[];
  storeProductIds?: Partial<Record<"steam" | "apple" | "google" | "web", string>>;
  maps?: string[];
  factions?: string[];
};

export type ContentPackSummary = Pick<
  ContentPackManifest,
  "id" | "name" | "version" | "description"
> & {
  maps: string[];
  factions: string[];
  coverArt?: string;
  modules?: string[];
  dependencies?: { id: string; version: string }[];
  storeProductIds?: ContentPackManifest["storeProductIds"];
};

export type ContentIssue = {
  pack?: string;
  file?: string;
  message: string;
};

export type ContentCatalog = {
  schemaVersion: 1;
  packs: ContentPackSummary[];
  maps: PortableMapDefinition[];
  factions: FactionDefinition[];
  issues: ContentIssue[];
};
