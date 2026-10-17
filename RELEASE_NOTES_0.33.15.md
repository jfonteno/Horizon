# Horizon 0.33.15

## Playtest usability

- Reworked the six-seat faction lobby so seats occupy separate grid cells around the room emblem at wide sizes, with a stacked two-column layout on narrower screens. Seat controls and longer names wrap within their cards.
- The room host can name or rename a room from its lobby, including an active or paused room. An empty name restores the room code. Room creation still accepts an optional name.
- The Orders tab places Review and seal at its top. The persistent bottom-right button opens the same private order review, which shows the queue, projected cost, and budget before Confirm or Cancel. Sealing still closes the Orders panel.
- Selected hexes show a compact total CU count. Expand Hex details for all military vessels in that hex, CU aboard each, stationed CU, production sources, installed Centers, and expansion assets. The detailed panel scrolls as a whole on small screens.
- Civilization Codex pages now include starting packages, faction abilities and unlocks, opening through late-game guidance, risks, and exact Civilization Legacy conditions and LP. Expansion civilizations include fuller background descriptions.

## Helix calibration

- New Helix games start with 1 Material and 2 Research. Helix Research Reallocation lets the player choose Research, Material, or Currency for the Homeworld's next Production. The selection replaces the usual Research output and persists until changed. The Economy panel and forecast reflect the choice.
- Helix bots use Reallocation when their economic reserve is short, while returning to Research when needed.
- Existing game state keeps its current resource balances. Reallocation is available immediately to existing Helix games after the update.

## Validation

Type checking, production build, and test suite run as part of release verification. Existing stored rooms and Commander data remain outside the application archive; back them up before replacing the server files.
