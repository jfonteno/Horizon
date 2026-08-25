import { installContentCatalog } from "./registry";
import type { ContentCatalog } from "./types";

const emptyCatalog = (): ContentCatalog => ({ schemaVersion: 1, packs: [], maps: [], factions: [], issues: [] });
const runtime = globalThis as typeof globalThis & { __horizonContentCatalog?: ContentCatalog };

export function setContentCatalog(catalog: ContentCatalog) {
  runtime.__horizonContentCatalog = structuredClone(catalog);
  installContentCatalog(catalog);
}

export function getContentCatalog() {
  return structuredClone(runtime.__horizonContentCatalog || emptyCatalog());
}
