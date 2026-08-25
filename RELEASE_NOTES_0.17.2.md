# Horizon: Shattered Reach 0.17.2

## Randomized starting positions

- Randomly assigns the selected factions among the map's currently active starting hexes whenever a new game is created.
- Keeps every map-defined starting hex in use without changing the map geometry or adding new starting locations.
- Moves each faction's explorer, colony ship, starting carrier, home ownership, and faction-specific starting Center together as one assignment.
- Uses a dedicated seeded random stream, making the same game seed reproduce the same faction positions without changing that seed's tile layout.
- Supports four, five, and six-player games as well as validated external maps.
- Updates Orders handoffs and new-Turn map centering to follow each player's randomized home instead of a hardcoded start index.

## Verification

- Adds regression coverage for unique home assignments, same-seed reproduction, different-seed variety, reduced player counts, and synchronized starting assets.
- Existing 0.17 content packs and saved games remain compatible.
