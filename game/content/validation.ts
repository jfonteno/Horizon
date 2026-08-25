import type { Resource, TechnologyBranch } from "../types";
import type { ContentPackManifest } from "./types";
import type { FactionDefinition } from "../factions/types";
import type { PortableMapDefinition } from "../maps/types";

const ID = /^[a-z][a-z0-9-]{1,47}$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i;
const HEX = /^\d+-\d+$/;
const COLORS = /^#[0-9a-f]{6}$/i;
const MAP_TILES = new Set(["material", "currency", "research", "influence", "labor", "barren", "anomaly", "hazard", "empty"]);
const RESOURCES = new Set<Resource>(["material", "currency", "research", "influence"]);
const BRANCHES = new Set<TechnologyBranch>(["Military", "Economy", "Policy", "Exploration", "Resource"]);
const PROFILES = new Set(["standard", "varkesh", "helix", "foundry", "aurelians", "meridian", "farbound"]);

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unknownKeys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

export function validateManifest(value: unknown): string[] {
  if (!object(value)) return ["manifest.json must contain an object."];
  const manifest = value as Partial<ContentPackManifest>;
  const issues: string[] = [];
  const extras = unknownKeys(value, ["schemaVersion", "id", "name", "version", "horizonVersion", "description", "maps", "factions"]);
  if (extras.length) issues.push(`Unknown manifest field(s): ${extras.join(", ")}.`);
  if (manifest.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (!ID.test(manifest.id || "")) issues.push("id must be a lowercase, URL-safe identifier.");
  if (typeof manifest.name !== "string" || !manifest.name.trim() || manifest.name.length > 80) issues.push("name must contain 1 to 80 characters.");
  if (!VERSION.test(manifest.version || "")) issues.push("version must use semantic versioning.");
  if (manifest.horizonVersion !== "0.17") issues.push("horizonVersion must be 0.17.");
  for (const field of ["maps", "factions"] as const)
    if (manifest[field] !== undefined && (!Array.isArray(manifest[field]) || manifest[field]!.length > 50 || manifest[field]!.some((entry) => typeof entry !== "string")))
      issues.push(`${field} must be an array of relative JSON paths.`);
  return issues;
}

export function validateMap(value: unknown): string[] {
  if (!object(value)) return ["Map file must contain an object."];
  const map = value as Partial<PortableMapDefinition>;
  const issues: string[] = [];
  const extras = unknownKeys(value, ["id", "name", "description", "rows", "columns", "starts", "regions", "blocked", "tilePool", "minPlayers", "maxPlayers", "tileAssets"]);
  if (extras.length) issues.push(`Unknown map field(s): ${extras.join(", ")}.`);
  if (!ID.test(map.id || "")) issues.push("Map id must be a lowercase, URL-safe identifier.");
  if (typeof map.name !== "string" || !map.name.trim()) issues.push("Map name is required.");
  if (typeof map.description !== "string") issues.push("Map description is required.");
  if (!Number.isInteger(map.rows) || (map.rows || 0) < 3 || (map.rows || 0) > 30) issues.push("Map rows must be an integer from 3 through 30.");
  if (!Number.isInteger(map.columns) || (map.columns || 0) < 3 || (map.columns || 0) > 30) issues.push("Map columns must be an integer from 3 through 30.");
  if (!Array.isArray(map.starts) || map.starts.length < 4 || map.starts.length > 6 || map.starts.some((id) => !HEX.test(id))) issues.push("Map starts must contain four to six hex IDs.");
  if (!Array.isArray(map.blocked) || map.blocked.some((id) => !HEX.test(id))) issues.push("Map blocked must be an array of hex IDs.");
  if (!Array.isArray(map.tilePool) || map.tilePool.some((kind) => !MAP_TILES.has(kind))) issues.push("Map tilePool contains an unsupported tile kind.");
  if (!object(map.regions)) issues.push("Map regions must be an object keyed by hex ID.");
  if (map.minPlayers !== undefined && (!Number.isInteger(map.minPlayers) || map.minPlayers < 4 || map.minPlayers > 6)) issues.push("Map minPlayers must be from 4 through 6.");
  if (map.maxPlayers !== undefined && (!Number.isInteger(map.maxPlayers) || map.maxPlayers < 4 || map.maxPlayers > 6)) issues.push("Map maxPlayers must be from 4 through 6.");
  if (map.minPlayers !== undefined && map.maxPlayers !== undefined && map.minPlayers > map.maxPlayers) issues.push("Map minPlayers cannot exceed maxPlayers.");
  if (object(map.tileAssets)) {
    const allowedAssets = new Set([...MAP_TILES, "home", "rift", "unrevealed"]);
    for (const [kind, reference] of Object.entries(map.tileAssets))
      if (!allowedAssets.has(kind) || typeof reference !== "string" || !reference) issues.push(`Invalid tile asset ${kind}.`);
  } else if (map.tileAssets !== undefined) issues.push("Map tileAssets must be an object.");
  if (!issues.length) {
    const ids = new Set(map.starts);
    if (ids.size !== map.starts!.length) issues.push("Map starts must be unique.");
    const blocked = new Set(map.blocked);
    if (map.starts!.some((id) => blocked.has(id))) issues.push("A starting hex cannot be blocked.");
    for (const id of [...map.starts!, ...map.blocked!]) {
      const [row, column] = id.split("-").map(Number);
      if (row >= map.rows! || column >= map.columns!) issues.push(`Hex ${id} is outside the map bounds.`);
    }
  }
  return issues;
}

export function validateFaction(value: unknown): string[] {
  if (!object(value)) return ["Faction file must contain an object."];
  const faction = value as Partial<FactionDefinition>;
  const issues: string[] = [];
  const extras = unknownKeys(value, ["id", "name", "role", "color", "blurb", "homeProduction", "objectives", "starting", "rulesProfile", "logo"]);
  if (extras.length) issues.push(`Unknown faction field(s): ${extras.join(", ")}.`);
  if (!ID.test(faction.id || "")) issues.push("Faction id must be a lowercase, URL-safe identifier.");
  if (typeof faction.name !== "string" || !faction.name.trim()) issues.push("Faction name is required.");
  if (typeof faction.role !== "string" || !faction.role.trim()) issues.push("Faction role is required.");
  if (typeof faction.blurb !== "string" || !faction.blurb.trim()) issues.push("Faction blurb is required.");
  if (!COLORS.test(faction.color || "")) issues.push("Faction color must be a six-digit hex color.");
  if (!RESOURCES.has(faction.homeProduction as Resource)) issues.push("Faction homeProduction is invalid.");
  if (!Array.isArray(faction.objectives) || faction.objectives.length !== 3 || faction.objectives.some((objective) => typeof objective !== "string" || !objective.trim())) issues.push("Faction objectives must contain exactly three descriptions.");
  if (faction.rulesProfile !== undefined && !PROFILES.has(faction.rulesProfile)) issues.push("Faction rulesProfile is unsupported.");
  if (faction.starting !== undefined && !object(faction.starting)) issues.push("Faction starting package must be an object.");
  if (object(faction.starting)) {
    const startingExtras = unknownKeys(faction.starting, ["resources", "technology", "laborCap", "homeCenter"]);
    if (startingExtras.length) issues.push(`Unknown starting field(s): ${startingExtras.join(", ")}.`);
    if (faction.starting.laborCap !== undefined && (!Number.isInteger(faction.starting.laborCap) || faction.starting.laborCap < 1 || faction.starting.laborCap > 10)) issues.push("starting.laborCap must be from 1 through 10.");
    if (faction.starting.homeCenter !== undefined && ![...RESOURCES, "labor", "defense"].includes(faction.starting.homeCenter)) issues.push("starting.homeCenter is invalid.");
  }
  if (faction.logo !== undefined && (typeof faction.logo !== "string" || !faction.logo)) issues.push("Faction logo must be a local asset path.");
  if (object(faction.starting?.resources))
    for (const [resource, amount] of Object.entries(faction.starting!.resources!))
      if (!RESOURCES.has(resource as Resource) || !Number.isInteger(amount) || Number(amount) < 0 || Number(amount) > 20) issues.push(`Invalid starting resource ${resource}.`);
  if (object(faction.starting?.technology))
    for (const [branch, level] of Object.entries(faction.starting!.technology!))
      if (!BRANCHES.has(branch as TechnologyBranch) || !Number.isInteger(level) || Number(level) < 1 || Number(level) > 4) issues.push(`Invalid starting Technology ${branch}.`);
  return issues;
}
