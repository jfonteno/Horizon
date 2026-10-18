# Horizon 0.35.8 playtest patch

- Fixes the recovery-page crash after selecting an Exploration vessel waypoint. The route planner no longer tries to inspect a military route without a selected military origin, or a vessel route without a selected vessel.
- Adds a regression test for both selection states.

Includes all 0.35.7 and 0.35.6 changes. Existing room and commander data can be retained during the update.
