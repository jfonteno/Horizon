# Horizon 0.30.1: Colony Ship Fleets

Colony Ships are now buildable noncombatants. Losing the only ship to ordinary fleet combat can no longer permanently block expansion or the First Horizon settlement lesson.

## Rules

- Build any number of additional Colony Ships at a controlled Habitat, subject to your shared construction budget.
- Each hull costs 2 Material, 2 Currency, and 1 Labor and becomes ready on the following Turn.
- Every ship has its own persistent identity, one-sector movement allowance, and one Order per Turn.
- Colony Ships are reusable. Establishment consumes one Habitat Module from the civilization's shared stock, not the hull. Building a ship does not grant a free Module.
- Ordinary military forces cannot destroy or capture Colony Ships. This applies to First Horizon and competitive games alike.
- Completed Habitats are still vulnerable. A hostile military force occupying a newly settled sector can fight its Home Guard and capture the Habitat without harming the ship.
- Future Corsair boarding remains a planned faction-specific exception. No ordinary capture command or playable Corsair ability is added in this release.

## Interface and AI

- Construction and map quick-build menus include Colony Ships.
- Multiple ships in one sector remain independently selectable and retain their own draft markers.
- Movement and establishment Orders explicitly target the selected ship.
- Readiness, ship ownership, duplicate Orders, legacy primary-ship aliases, and available Modules are checked by the authoritative Orders validator.
- Turn replays track each Colony Ship individually.
- Bots route and settle with multiple ships, replace a missing fleet, and consider additional hulls for useful early expansion routes.
- First Horizon and the Codex explain the new immunity and construction rules.

## Save compatibility

Game schema 18 migrates existing single-ship saves and rooms into a Colony Ship fleet without moving an existing ship. Older saves whose ship was already destroyed receive an empty fleet and can build a replacement at any controlled Habitat. Explicitly empty current fleets stay empty rather than recreating ships from the legacy location field. Existing Orders without vessel IDs continue to target the first Colony Ship.

## Verification

Regression coverage includes repeatable construction and cost reservation, next-Turn readiness, independent movement and settlement, individual replay identities, combat immunity in First Horizon and ordinary games, Habitat capture, multiple-ship AI planning, ownership and duplicate-order rejection, and migration of local saves and persisted rooms.
