# Horizon Content Packs

Horizon 0.22 loads external maps, factions, visual assets, expansion catalog metadata, and future module identifiers from versioned Content Packs. Packs are ordinary folders under `data/content` and require no application rebuild. The self-hosted server validates every pack during startup and rejects the entire pack if any declared file is unsafe, malformed, duplicated, or incompatible.

## Install a pack

```text
data/
  content/
    my-expansion/
      manifest.json
      maps/
      factions/
      assets/
```

Copy the pack folder into `data/content`, validate it, and restart Horizon:

```bash
npm run validate:content -- ./data/content
docker compose restart horizon
docker compose logs --tail=100 horizon
```

Installed maps appear in the setup map selector. Installed factions join the seat-selection rotation. A game records the exact ID and version of every external pack it uses. The server refuses to open that game if a required version is missing, preventing silent rule or map substitution.

The included `content-packs/frontier-example` folder is a complete reference. To activate it on a self-hosted server:

```bash
mkdir -p data/content
cp -R content-packs/frontier-example data/content/
npm run validate:content -- ./data/content
docker compose restart horizon
```

## Manifest

Every pack begins with `manifest.json`:

```json
{
  "schemaVersion": 1,
  "id": "my-expansion",
  "name": "My Expansion",
  "version": "1.0.0",
  "horizonVersion": "0.17",
  "description": "A new region and civilization.",
  "coverArt": "assets/cover.webp",
  "modules": ["example-module"],
  "dependencies": [{ "id": "horizon-core", "version": "1.0.0" }],
  "storeProductIds": {
    "steam": "example-steam-dlc",
    "apple": "com.example.horizon.pack",
    "google": "example_horizon_pack",
    "web": "example-horizon-pack"
  },
  "maps": ["maps/my-map.json"],
  "factions": ["factions/my-faction.json"]
}
```

IDs must be lowercase and URL-safe. Versions use semantic versioning. Paths must remain inside the pack directory. Core IDs and IDs from another installed pack cannot be replaced.

## Maps

A map declares its dimensions, four to six starting hexes, region names, blocked hexes, discovery tile pool, supported player range, and optional tile art. Hex IDs use `row-column` coordinates and must remain inside the declared dimensions.

Supported tile kinds are `material`, `currency`, `research`, `influence`, `labor`, `barren`, `anomaly`, `hazard`, and `empty`. Homeworld and rift hexes are derived from starts and blocked positions.

The optional `tileAssets` object can override any tile kind or `unrevealed`. Local PNG, WebP, JPEG, and SVG files are supported up to 3 MB each. Existing application assets can be referenced with an absolute application path such as `/tiles/tile-material.webp`.

## Factions

A faction declares:

- Identity, role, color, description, and optional logo
- Homeworld production resource
- Three Civilization Legacy descriptions
- Starting resource and Technology values
- Optional starting Labor Capacity and Homeworld Center
- A deterministic rules profile

The `standard` rules profile has no exclusive faction action. External factions may reuse one of the six core profiles to inherit that complete rules package and the Meta Analyst doctrine: `varkesh`, `helix`, `foundry`, `aurelians`, `meridian`, or `farbound`.

Standard-profile Civilization Legacy objectives are confirmation-based and award 3, 4, and 5 LP. A later ability-language patch can add new automatic triggers and effects without allowing arbitrary code execution.

## Safety and compatibility

- Content files are data, not executable JavaScript or TypeScript.
- JSON files are limited to 1 MB and visual assets to 3 MB.
- Directory traversal, remote asset URLs, unsupported formats, duplicate IDs, and incompatible schema versions are rejected.
- One invalid declared file rejects its entire pack.
- Existing games pin pack versions, so update a pack only between games unless its version remains unchanged and its changes are save-compatible.
- Backups created by Horizon 0.17 include both `rooms` and `content`.

Cloudflare Worker deployments continue to expose only compiled core content unless a future hosted content store is configured. Disk hot-drop loading is designed for the self-hosted Node server.
