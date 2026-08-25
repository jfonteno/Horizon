# Horizon: Shattered Reach 0.17.0

## Content Pack Foundation

- Added startup discovery for versioned external Content Packs under `data/content`.
- Added hot-droppable map definitions with dimensions, starts, regions, blocked hexes, tile pools, player limits, and optional tile artwork.
- Added hot-droppable faction definitions with identity, production, objectives, starting resources, Technology, Labor, Home Centers, logos, and deterministic rules profiles.
- Added reusable core faction rules profiles so external faction identities can inherit an existing complete mechanic and AI doctrine.
- Added strict manifest, map, faction, file-size, path, asset, compatibility, and duplicate-ID validation.
- Added `/api/content` discovery and dynamic setup selectors for installed maps and factions.
- Added exact pack ID and version requirements to game state and network-room recovery.
- Added missing-pack protection for local saves and authoritative multiplayer rooms.
- Added map-specific unrevealed and tile artwork support.
- Added `npm run validate:content` and a complete Frontier Example Pack.
- Updated backups and restores to preserve installed content alongside room state.
- Added automated pack loading, artwork, registration, game creation, Legacy, and validation coverage.

## Current extension boundary

Maps are fully data-driven. Factions can use standard rules or inherit one core faction rules profile. Completely new automatic triggers and effects will be introduced through a future deterministic ability language rather than arbitrary executable plugins.
