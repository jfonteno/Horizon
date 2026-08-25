# Horizon: Shattered Reach 0.16.0

## Multiplayer Beta

Version 0.16.0 turns the Network Operations alpha into a persistent multiplayer beta with a formal lobby, recoverable browser sessions, host administration, deterministic allied combat, spectator pacing, and complete network endgame analytics.

### Lobby and invitations

- Every new network room begins in a pregame lobby.
- Human seats must be claimed and marked ready before the host can begin.
- Bot seats are automatically ready and remain server controlled.
- Player invitations open setup with the room code already filled in.
- Spectator links open the redacted public board directly.
- The lobby clearly identifies claimed, open, ready, and AI-controlled civilizations.

### Host administration

- Hosts can start a ready room, pause an active game, resume play, or end and archive the current state.
- A host can assign another human or open seat to the Strategic Director while the room is in the lobby or paused.
- Gameplay commands are rejected while the room is waiting in the lobby, paused, or complete.
- Ending a playtest preserves the latest standings and opens the complete analytics dashboard.

### Reconnection and command safety

- Private room tokens remain stored in the browser and automatically reclaim the same seat after refresh.
- Atomic compare-and-swap revisions protect simultaneous writes.
- Every client command now includes a stable command ID. Retried commands return the recorded result instead of spending resources or applying movement twice.
- Untrusted JSON commands pass runtime shape, integer, string-length, Order-count, and payload-size validation before reaching the rules engine.
- Room command receipts retain the latest 300 accepted commands for duplicate protection.
- Room event history retains the latest 200 public events without exposing proposal terms, Hidden Legacy cards, private surveys, or sealed Orders.

### Persistent room migrations

- Stored rooms now use room schema version 2.
- Existing 0.13 through 0.15 payloads receive defaults for mode, controllers, readiness, event history, and command receipts when loaded.
- D1-backed rooms apply the same migration path as in-memory development rooms.
- Completed games remain archived in persistent room storage.

### Deterministic allied combat

- Alliance fleets in the same battle resolve as one coalition.
- A Defensive Pact combines a co-stationed partner with the Habitat owner's defense.
- Home Guard, Defense Grid, Assault Vessel reduction, stationed CU, and allied carrier CU contribute to the same exact coalition strength calculation.
- Coalition losses use subtraction casualties and stable carrier ordering.
- If an attacking coalition captures a Habitat, ownership goes to the participating coalition member that contributed the greatest carrier strength, with player order as the deterministic tiebreaker.
- Varkesh coalition members receive Glory against defeated hostile civilizations under the existing once-per-Turn limit.
- Non-hostile forces are not incorrectly counted as enemy opposition.

### Player guidance and spectators

- Navigation badges identify unanswered diplomatic proposals and a missing Era Hidden Legacy selection.
- Turn status identifies unresolved capture bookkeeping, diplomatic responses, and mandatory objective selection.
- Public sealed-Order status is derived from safe room metadata, never from opponents' private Order payloads.
- Spectators can pause their local feed and choose fast, live, or slow synchronization.
- The public projection continues to remove Hidden Legacy cards, surveys, proposals, pending Labor, sealed Orders, selected units, and bot analysis.

### Endgame review

- Completed network games open the existing performance dashboard automatically.
- Graphs show LP, total resources, controlled Habitats, and accepted trades across all recorded Turns.
- Final standings retain Gate contributions, Technology, military strength, Legacy categories, peak reserves, and peak Habitat counts.

### Verification

- Added regression coverage for lobby readiness, host controls, paused-command rejection, duplicate command IDs, runtime validation, Defensive Pact defense, and Alliance capture assignment.
- Existing military, diplomacy, privacy, stale-revision, save migration, bot, Legacy, geometry, visual asset, and complete production-build tests remain part of the release gate.
