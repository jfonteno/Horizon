# Horizon 0.35.7 playtest patch

- Moving a military task force, Exploration vessel, Colony Ship, or faction civilian vessel now opens a step-by-step route planner. Tap adjacent highlighted hexes to add waypoints, undo a step if needed, and confirm the whole route before it enters the private Order queue.
- Numbered route markers and a route preview show the exact path. Known hostile territory, military vessels, Blockades, and unrevealed sectors are called out before confirmation. A route through known danger requires an explicitly labeled confirmation.
- Military routes are checked at the server before Orders seal. Invalid paths cannot skip hexes, exceed the available movement, use more than one portal, or end somewhere other than their declared destination. Earlier Orders that included the starting hex in the path still resolve correctly.
- The Orders list names each waypoint rather than showing only the destination.

This release also includes all 0.35.6 changes. Keep existing room and commander data when updating.
