# Horizon 0.33.14

## Closed-beta playtest clarity

- Adds a stable icon and color language for Material, Currency, Research, Influence, Labor, and Legacy in the map resources, faction strip, and Economy panel. Color is not the sole identifier.
- Adds a deterministic next-Production forecast with per-world, per-Center, enhancement, Factory, Homeworld, and deployed mobile Habitat sources. Conditional trades and future builds are excluded. Labor capacity is shown separately.
- Owned-hex details now include itemized output with Center production tooltips and tap-accessible details.
- Adds strategic faction guides to Academy and lobby dossiers, including opening priorities, middle and late-game identity, and common pitfalls.
- Rebuilds the six-seat lobby as bounded radial grid placement and enlarges the central Horizon logo.
- Lowers the mobile map zoom floor to 20%, fits against actual viewport padding, and adds bottom pan clearance. Existing pointer-based pinch and desktop clicks remain active.
- The Orders review lists ready vessels without Orders as an advisory, with a tap to focus each vessel. Holding is valid.
- The Salvo Bombard Frigate exposes Move on selection unless a strength-2 Bombardment Order locks movement.
- Meridian Brokerage now sends a pending offer to both trading civilizations. Human players explicitly approve or decline; bots assess the exchange. Resources move only after both approvals, with settlement and sealed-Order budgets checked again. The Meridian earns its Currency reward only from the first completed Brokerage each Turn. Additional pairs may trade without further Currency rewards. Brokerage rejects malformed, one-sided, and same-resource bundles.
- Newly assigned lobby bots and Quick Start bots use the Meta Analyst profile. Existing game seats are unchanged.
- First Horizon places a Currency world adjacent to the Foundry start and explicitly teaches the opening route.

## Audio

- Tactical Focus is the looping active-match score, encoded as MP3 for delivery. The existing menu playlist still plays only in menus and room lobbies.
- Single Click is the basic control sound across the interface. Settings now expose soundtrack and click muting and independent volume controls. Browser autoplay rules may require a user interaction before music starts.

## Compatibility

- Existing rooms, accounts, saves, and Orders remain compatible. Older rooms receive an empty Brokerage inbox when loaded. Keep the persistent `data` directory and authentication configuration when installing into a new folder. See `docs/SELF_HOSTING.md` for Windows and Docker upgrade steps.
