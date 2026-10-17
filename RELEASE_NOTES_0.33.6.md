# Horizon 0.33.6

## Era transition recovery

- Hidden Legacy choices are prepared automatically when each Era begins.
- Existing rooms with absent or incomplete current-Era choices are repaired when loaded.
- Mandatory captured-Center and post-combat CU cleanup now takes precedence over the Hidden Legacy selection overlay.
- Post-combat redistribution can be completed on the first Turn of a new Era before selecting that Era's objective.
- Fleet Command opens automatically when surviving Combat Units require redistribution.
- After cleanup is complete, the Hidden Legacy selection overlay appears and the selected objective is committed normally.

## Validation

- Added an Era IV regression test covering the cleanup-to-objective sequence.
- Added interface coverage confirming that mandatory combat cleanup suppresses the objective overlay.
- Verified Hidden Legacy preparation and selection across authoritative multiplayer room state.
