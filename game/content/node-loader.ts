import { readdir, readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { FactionDefinition } from "../factions/types";
import type { PortableMapDefinition } from "../maps/types";
import type { ContentCatalog, ContentIssue, ContentPackManifest, ContentPackSummary } from "./types";
import { validateFaction, validateManifest, validateMap } from "./validation";

const MAX_JSON_BYTES = 1_000_000;
const MAX_ASSET_BYTES = 3_000_000;
const mimeTypes: Record<string, string> = {
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function within(directory: string, relativePath: string) {
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("\\"))
    throw new Error(`Unsafe pack path: ${relativePath || "(empty)"}`);
  const target = resolve(directory, relativePath);
  if (target !== directory && !target.startsWith(`${directory}${sep}`))
    throw new Error(`Pack path escapes its directory: ${relativePath}`);
  return target;
}

async function jsonFile(directory: string, relativePath: string) {
  const target = within(directory, relativePath);
  const information = await stat(target);
  if (!information.isFile() || information.size > MAX_JSON_BYTES)
    throw new Error(`${relativePath} must be a JSON file no larger than 1 MB.`);
  return JSON.parse(await readFile(target, "utf8")) as unknown;
}

async function asset(directory: string, reference: string) {
  if (reference.startsWith("/")) return reference;
  const target = within(directory, reference);
  const mime = mimeTypes[extname(target).toLowerCase()];
  if (!mime) throw new Error(`Unsupported asset type: ${reference}`);
  const information = await stat(target);
  if (!information.isFile() || information.size > MAX_ASSET_BYTES)
    throw new Error(`${reference} must be an image no larger than 3 MB.`);
  const bytes = await readFile(target);
  if (mime === "image/svg+xml" && /<script\b|\son[a-z]+\s*=|javascript:/i.test(bytes.toString("utf8")))
    throw new Error(`SVG asset contains active content: ${reference}`);
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

async function loadPack(directory: string) {
  const manifestValue = await jsonFile(directory, "manifest.json");
  const manifestIssues = validateManifest(manifestValue);
  if (manifestIssues.length) throw new Error(manifestIssues.join(" "));
  const manifest = manifestValue as ContentPackManifest;
  const maps: PortableMapDefinition[] = [];
  const factions: FactionDefinition[] = [];

  for (const file of manifest.maps || []) {
    const value = await jsonFile(directory, file);
    const issues = validateMap(value);
    if (issues.length) throw new Error(`${file}: ${issues.join(" ")}`);
    const map = structuredClone(value) as PortableMapDefinition;
    map.sourcePack = manifest.id;
    map.sourcePackVersion = manifest.version;
    if (map.tileAssets)
      for (const [kind, reference] of Object.entries(map.tileAssets))
        map.tileAssets[kind as keyof typeof map.tileAssets] = await asset(directory, reference!);
    maps.push(map);
  }
  for (const file of manifest.factions || []) {
    const value = await jsonFile(directory, file);
    const issues = validateFaction(value);
    if (issues.length) throw new Error(`${file}: ${issues.join(" ")}`);
    const faction = structuredClone(value) as FactionDefinition;
    faction.sourcePack = manifest.id;
    faction.sourcePackVersion = manifest.version;
    if (faction.logo) faction.logo = await asset(directory, faction.logo);
    factions.push(faction);
  }
  const summary: ContentPackSummary = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    coverArt: manifest.coverArt ? await asset(directory, manifest.coverArt) : undefined,
    modules: manifest.modules || [],
    dependencies: manifest.dependencies || [],
    storeProductIds: manifest.storeProductIds,
    maps: maps.map((map) => map.id),
    factions: factions.map((faction) => faction.id),
  };
  return { summary, maps, factions };
}

export async function loadContentPacks(rootDirectory: string): Promise<ContentCatalog> {
  const root = resolve(rootDirectory);
  const catalog: ContentCatalog = { schemaVersion: 1, packs: [], maps: [], factions: [], issues: [] };
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return catalog;
    throw error;
  }
  const mapIds = new Set<string>(["shattered-reach"]);
  const factionIds = new Set<string>(["varkesh", "helix", "foundry", "aurelians", "meridian", "farbound", "spires", "aegis", "wayfarers", "salvo", "guilds"]);
  for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    try {
      const loaded = await loadPack(resolve(root, entry.name));
      if (new Set(loaded.maps.map((map) => map.id)).size !== loaded.maps.length ||
          new Set(loaded.factions.map((faction) => faction.id)).size !== loaded.factions.length)
        throw new Error("A content pack cannot declare the same map or faction id twice.");
      const duplicateMap = loaded.maps.find((map) => mapIds.has(map.id));
      const duplicateFaction = loaded.factions.find((faction) => factionIds.has(faction.id));
      if (duplicateMap || duplicateFaction)
        throw new Error(`Duplicate content id ${duplicateMap?.id || duplicateFaction?.id}.`);
      loaded.maps.forEach((map) => mapIds.add(map.id));
      loaded.factions.forEach((faction) => factionIds.add(faction.id));
      catalog.packs.push(loaded.summary);
      catalog.maps.push(...loaded.maps);
      catalog.factions.push(...loaded.factions);
    } catch (error) {
      const issue: ContentIssue = {
        pack: entry.name,
        message: error instanceof Error ? error.message : "Content pack could not be loaded.",
      };
      catalog.issues.push(issue);
    }
  }
  return catalog;
}
