# Horizon: Shattered Reach 0.18.1

## Lobby faction selection

- Separated network seat claiming from faction selection.
- Added a faction draft to the room lobby with faction names, roles, colors, and available logos.
- Allowed the host to wait while other players choose, then select from the factions that remain.
- Prevented two seats from selecting the same faction.
- Required every human player to choose a faction before marking Ready.
- Made Ready lock the faction choice. A player can mark their seat not ready to change it.

## Deterministic setup

- Rebuilds the pre-game faction packages on the server after each lobby selection.
- Preserves the room seed, map, player count, controllers, and randomized starting hex assigned to every seat.
- Applies each chosen faction's resources, technology, objectives, units, rules profile, and home-center effects before play begins.
- Stores the completed draft as the authoritative initial game when the host starts the room.

## Seat administration and compatibility

- Lobby bot seats reserve unique factions automatically.
- Returning a bot seat to human control or reopening a human lobby seat releases its faction for selection.
- Human replacements during a paused game inherit the faction already in play.
- Existing rooms migrate with their current factions treated as selected, preserving active and in-progress games.

## Hosting

- Updated package, health endpoint, container image, interface, report metadata, and self-hosting documentation to version 0.18.1.
- No Cloudflare Tunnel or Docker Compose configuration changes are required beyond rebuilding the Horizon container.
