# Horizon 0.33.2

Horizon 0.33.2 rebuilds the multiplayer staging area and expands the Operations console for controlled closed-beta playtesting.

## Faction selection

- Game seats now form a radial command display around the Horizon core.
- Every seat shows its selected faction, controller, commander, and Ready status.
- A human player chooses a faction by selecting their glowing seat, reviewing the existing faction dossier, and confirming the faction.
- Hosts can switch every non-host seat between Human and Bot directly below its circle.
- Bot factions can be assigned explicitly or left Random until launch.
- Human and bot seats remain interchangeable during the lobby and supported game-recovery flows.

## Playtest access controls

- Operations Owners and Administrators can switch multiplayer verification between Commander accounts and temporary Room Code access.
- Room Code mode asks anonymous invitees for a display name and keeps their seat credential on that browser. Signed-in players retain account-backed recovery.
- Operators can pause new room creation, disable spectator entry, and publish a network-wide status notice.
- Access changes are persisted separately from room and account data and include an operator, reason, timestamp, and bounded audit trail.
- Disk, D1, backup, restore, Docker, and native self-hosting paths now include Operations settings.

## Live game operations

- The Operations console now separates Dashboard, Games, Commanders, and Access views.
- Authorized operators can inspect public room state without exposing private Orders, Hidden Objectives, surveys, credentials, or private messages.
- Owners and Administrators can pause or resume active games, post room notices, and end a game with a required reason.
- Live room cards show seats, factions, controllers, Ready state, Turn and Era, reports, feedback, and authoritative revision.
- Service health now includes the Operations settings repository.

## Deployment note

Commander verification remains the default. Room Code access should be enabled only for a deliberate playtest window, since anonymous seats cannot be recovered on another device unless the player signs in.
