# Horizon 0.8.0: Repository and Multiplayer Foundation

## Added

- Server-backed rooms with six-character invitation codes.
- Host resume tokens and private player-seat resume tokens.
- Four-to-six-player room seat claims with player display names.
- Authoritative room snapshots with optimistic revision checks.
- Cross-device private room views through the shared room API.
- Player-specific state projection that protects Hidden Legacy, Farbound surveys, private proposals, pending Labor, and unrevealed tile contents.
- A read-only private seat dashboard for the current multiplayer foundation stage.
- In-memory room storage for the downloadable local server.
- D1-backed persistent room storage for configured hosted builds.
- Database schema and migration for serialized room state.
- GitHub continuous integration and tagged release packaging.
- A reproducible `npm run package:release` archive command.
- Repository contribution and multiplayer architecture documentation.

## Compatibility

Version 0.8.0 migrates previous local saves to schema version 8. Existing diplomacy, fleets, faction operations, Legacy claims, private objectives, map state, and scores remain intact.

## Deliberately deferred

Remote seats are read-only in this foundation patch. Live server-validated commands, simultaneous secret orders, edge conflicts, and complete allied-defense coordination remain later multiplayer milestones.
