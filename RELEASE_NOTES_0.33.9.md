# Horizon 0.33.9

## Automatic lobby launch

Room hosts can now enable **Start automatically when all humans are ready** when creating a network room or from the faction-selection lobby.

Automatic launch is disabled by default. When enabled, the server starts the match after all of these requirements are satisfied:

- Every human seat is claimed.
- Every human player has selected a faction.
- Every human player is marked Ready.
- Every bot has an assigned faction or is set to Random.

The host does not need to keep Horizon open. The final player readiness update performs the launch on the authoritative server. Random bot factions are locked during that same transaction.

If the room has a Turn timer, its first deadline begins immediately when the automatic launch occurs. The lobby displays this behavior before players ready.

## Persistence and compatibility

- Ready states continue to persist when a player closes the browser or app.
- The automatic-launch preference is stored with the room and survives reconnects and server restarts.
- Existing rooms migrate with automatic launch disabled.
- Rematch lobbies inherit the prior room's automatic-launch preference and Turn timer.
- Manual **Start game** remains available to the host when automatic launch is disabled or before all requirements are satisfied.

## Validation

Regression coverage verifies host-only configuration, default-off behavior, persisted readiness, Random bot assignment, host-offline launch, and Turn timer activation.
