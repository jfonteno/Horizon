# Horizon 0.33.11

## Closed Beta Continuity

- Replaces the opening-screen room stack with one My Games destination.
- Separates ongoing lobbies and matches from completed games while preserving action counts, deadlines, and cross-device recovery.
- Includes device-local saves and room-code-only sessions inside My Games instead of placing separate shortcuts on the opening screen.
- Adds optional room names during creation. Invitation codes remain visible and continue to control joining and recovery. Blank names automatically use the generated code.
- Displays room names in the faction lobby, live match header, Commander account, playtest report, and Operations data.

## Turn Resolution

- Allows a Habitat Module constructed during a Turn to support an Establish Order sealed for that same Turn.
- Tracks Module supply against every drafted Establish Order and explains the exact shortage before Orders are sealed.
- Preserves independent multi-Colony Ship settlement when enough existing and drafted Modules are available.

## Aegis Security Export

- Corrects the command validator so Blockade resource-bundle prices are not mistaken for a scalar integer.
- Normalizes each price field to a whole value from zero to 99 before transmission.
- Retains scalar integer validation for Farbound Survey Exchange prices.

## Compatibility

- Existing rooms migrate to room schema 12 automatically and use their room code as the initial name.
- Existing invitation codes, room tokens, Commander links, saved games, and Blockade state remain compatible.
