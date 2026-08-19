# Horizon architecture

The project separates content definitions from game behavior and presentation. New content should be added as a package and registered through a library index.

## Faction library

Every civilization lives in its own file under `game/factions/`. A faction definition owns its identity, color, starting changes, home production, and public objectives.

To add a faction:

1. Add its ID to `FactionId` in `game/factions/types.ts`.
2. Create `game/factions/<id>.ts` exporting a `FactionDefinition`.
3. Import and register it in `game/factions/index.ts`.

Faction-specific actions and scoring hooks should eventually use explicit lifecycle hooks rather than faction-name checks. Planned hooks include `modifyCost`, `onCombatResolved`, `onProduction`, `availableActions`, and `scoreObjectives`.

## Map library

Every map lives under `game/maps/` and provides dimensions, starting hexes, region names, blocked hexes, tile pools, and player-count support. The engine receives a `MapId`, loads the registered map, and generates state from that definition. A future Standard map can coexist with Shattered Reach without duplicating the interface.

Hazards are optional map-package content. The standard Shattered Reach definition intentionally contains none. A future hazard-enabled map should register its hazard set within that map package instead of adding hazards to the shared base rules.

## Visual packages

Theme metadata lives under `game/themes/`. Theme CSS lives under `app/themes/`. Both use the same `ThemeId`.

A visual package should control colors, typography, surfaces, token and hex rendering, and optional asset paths. It must not change game rules. Horizon Base and Tactical Amber demonstrate runtime switching.

Version 0.10.0 centralizes tile artwork and vessel icon types in `game/themes/assets.ts`. The board renderer treats tile imagery, faction ownership borders, unit silhouettes, numeric badges, and interaction states as separate layers. Hidden hexes select the neutral unrevealed asset from the player-authorized view rather than loading their underlying tile artwork.

## Rules and engine

Static costs and shared rules belong in `game/rules/`. The fleet registry, carrier construction, CU transfer, movement, combat, and capture rules live in `game/rules/fleet.ts`. The sealed-order protocol and deterministic batch resolver live in `game/rules/orders.ts`. State creation, movement geometry, and save migration live in `game/engine/`.

The deterministic command engine follows this contract:

```text
current state + sealed command batch + ruleset = next state + event log
```

This lets the same engine power the local client, an online server, automated playtests, and replay tools.

## Save compatibility

Game state includes `schemaVersion`, `mapId`, and `themeId`. Persistent state changes should add a migration in `game/engine/save-game.ts` rather than invalidating saves.

## Sealed Orders and multiplayer foundation

Version 0.9.0 builds on the transport-independent room service under `game/server/`. The local client, room API, D1 adapter, private-view projector, and tests all use the same `GameState` contract.

The room host publishes canonical hot-seat snapshots. Each room save carries a monotonic revision, and stale writes are rejected. Claimed player seats receive only a projected copy of the canonical state. This projection removes other players' secret objectives, sealed Orders, surveys, private proposals, pending Labor, and hidden map contents.

The downloadable local server uses an in-memory repository. A configured hosted Worker injects D1 into the same service and persists serialized rooms through the `horizon_rooms` table. The repository interface permits a later PostgreSQL adapter without changing the room API or privacy rules.

The local client now collects a sealed `SecretOrderSubmission` for every civilization and resolves the batch only when all seats are ready. Scans, movement, edge conflicts, hex combat, location actions, construction, Technology, Tributes, and scoring run in a fixed sequence. The same starting state and sealed batch therefore produce the same result.

The next multiplayer stage should replace host snapshot publication with server-validated submissions to this existing order engine. That stage will add live remote order entry and richer account-backed invitations without changing the game rules.

GitHub Actions verify lint, production build, game rules, room behavior, and privacy boundaries. Tagged releases create clean downloadable source packages through the repository's versioned packaging script.

Do not put secrets in the repository. Use environment variables locally and deployment secrets in hosted environments.
