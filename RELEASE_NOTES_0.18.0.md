# Horizon: Shattered Reach 0.18.0

## Playtest readiness

- Added responsive network layouts for phones and tablets, larger touch targets, a scrollable tactical map, and compact room/lobby surfaces.
- Replaced the Bash dependency in build, lint, typecheck, test, and artifact validation with a cross-platform Node task runner.
- Moved Cloudflare development tooling to optional dependencies so standalone Termux installations can continue when `workerd` is unavailable on Android.
- Preserved the existing Linux CI and self-hosted production paths.

## Playtest reports

- Hosts can download a structured JSON report from the Room screen at any point in a game.
- Reports include the exact seed, map, factions, starting hexes, content packs, standings, LP/resource/habitat/trade history, room events, resolution logs, bot reports, and audit verification result.
- Report export is authenticated with the host token. Spectators and ordinary player seats cannot access private Orders or diagnostic data.

## Deterministic audit ledger

- New rooms retain a chained SHA-256 ledger for every accepted command and resulting authoritative room state.
- Ledger entries include sequence, command identifier, actor, revision, command payload, state hash, and previous-entry hash.
- Reports carry the initial game, ordered accepted commands, expected state hashes, and final game as a deterministic investigation bundle.
- Diplomatic proposal IDs now derive from idempotent command IDs instead of runtime randomness.
- Existing rooms migrate safely and are explicitly marked as pre-ledger rather than being represented as fully verified.

## Room administration

- Hosts can pause and resume play, end and archive games, reopen disconnected human seats, assign the Strategic Director AI, return AI seats to human control, and override lobby readiness.
- Hosts can post visible rules and timing notices to the room history.
- Seat-token reset remains restricted to the lobby or a paused game, and the active host seat cannot be displaced.

## Compatibility

- Save and room data from 0.17.x remain loadable.
- The disk-room service remains intentionally single-process. Multiple application replicas still require a shared transactional repository.
