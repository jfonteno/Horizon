# Horizon 0.22.0

Horizon 0.22.0 replaces the playtest setup page with the permanent foundation for a premium desktop, mobile, and web application. It includes every 0.21.2 rule, persistence, room, and Windows save fix.

## Premium application shell

- Branded Horizon Gate startup animation performs content loading and session recovery before opening the application.
- New main menu provides Continue Game, Continue Local Game, Create Game, Join Game, Solo Simulation, Faction Codex, Expansions, and Settings.
- Saved room identities surface directly on the home screen.
- Invitation links open the Join Game screen and preserve the supplied room code.
- Direct room links continue to resume existing seats or spectator sessions.
- Responsive layouts support desktop, tablet, and phone safe areas without returning to the old nested setup page.
- Arrow-key and basic gamepad navigation are available throughout the application shell. Mouse and touch controls remain supported.

## Guided game creation

- Five-step creation flow covers game format, map, content, player seats, and final review.
- Map cards explain supported players, geography, and content source.
- Local games retain human and AI seat configuration.
- Network rooms continue to let each player claim a seat and choose their own faction.
- Visual packages moved into persistent application settings.

## Lobby and faction presentation

- The opening room lobby now uses a full-screen command layout with room, map, format, content, timer, and launch status summaries.
- Player seats show faction emblems, controller status, readiness, and the current player.
- The existing faction showroom is retained and expanded within the larger lobby surface.
- The faction Codex is available from the main menu without joining a room.
- Host administration, invitation links, Turn timers, faction selection, Ready locks, bot conversion, reports, notices, and room history remain available.

## Expansion foundation

- New Expansion center distinguishes included, installed, and upcoming content.
- External content manifests may declare cover art, optional module IDs, dependencies, and Steam, Apple, Google, and web product identifiers.
- Manifest metadata remains declarative and validated. Content packs cannot execute arbitrary code.
- Games continue to pin the exact ID and version of every external map or faction pack they use.
- A platform capability adapter isolates future native identity, purchase, achievement, notification, deep-link, fullscreen, and quit behavior from game rules.
- Hidden Hands appears as a coming-soon catalog entry and is not selectable in live games.

## Settings and accessibility

- Reduced motion disables decorative shell animation and transitions.
- Larger interface text increases shell readability.
- Both settings persist on the device.
- Keyboard focus remains visible, and controller navigation uses the same semantic controls.

## Compatibility

- Existing 0.21.x room JSON, room codes, seat tokens, local saves, content packs, Cloudflare routing, and Windows startup remain supported.
- Existing active rooms can be copied with the data folder and resumed after upgrading.
- The authoritative board UI and game rules are unchanged except for version and expansion-catalog plumbing.

## Upgrade

1. Stop the current Horizon server.
2. Back up the complete data folder.
3. Extract 0.22.0 into a new folder and copy the old data folder into it.
4. Run Start-Horizon-Windows.cmd.
5. Reload browser clients. Cloudflare Tunnel settings do not change.

## Validation

The release gate covers lint, TypeScript, a standalone production build, production asset delivery, Windows save reliability, room migrations, lobby commands, faction selection, network action parity, expansion metadata validation, and the platform capability adapter. Browser screenshot inspection is unavailable in the build workspace, so final visual review should be performed on the target Windows server at desktop and phone widths.
