# Horizon 0.26.1: Geometry Patch

Horizon 0.26.1 is a focused interface and map-rendering patch. It does not change game rules, save schemas, Commander Identity, or room protocols.

## Map geometry

- Map and vessel grids now read their column and row counts from the active map definition.
- Hex staggering uses each sector's actual column parity instead of DOM child-number selectors.
- Canvas dimensions preserve a consistent sector scale across 5x5, 9x9, and 11x11 boards.
- Local and network play use the same geometry calculation and offset rules.
- Regression coverage verifies all three supported geometry sizes and rejects the old hardcoded selectors.

## First Horizon guidance

- Mission guidance now lives in the right information rail instead of a fixed bottom-corner overlay.
- The guide can be minimized and restored without marking the tutorial abandoned.
- Required map controls, action buttons, and mobile navigation remain unobstructed.

## Compatibility

Existing 0.26.0 game and room saves remain compatible. No migration is required.
