# Horizon: Shattered Reach 0.15.0

## Network Operations

Version 0.15.0 completes the next playable-network milestone by bringing the military command loop and diplomacy console into authoritative online rooms.

### Military command

- Select one or more ready carriers occupying the same hex to form a task force.
- Review carrier capacity, loaded Combat Units, and remaining movement.
- Compare task-force strength with public adjacent opposition before committing movement.
- Select Move, then click a highlighted legal destination on the shared map.
- Seal military movement inside the private simultaneous Order queue.
- Load Combat Units from controlled Habitats and station Combat Units from carriers through authenticated commands.
- Resolve edge combat, combined hex combat, captures, casualties, Varkesh rewards, Non-Aggression restrictions, Open Borders, and defensive relationships through the existing deterministic engine.
- Pause the room when a captured Habitat must lose excess Centers and require the conquering player to finish that decision.

### Diplomacy command

- Send direct trade proposals with Material, Currency, Research, and permanent Labor Capacity.
- Propose Trade Agreements, Non-Aggression Pacts, Open Borders, Research Agreements, Defensive Pacts, and Alliances.
- Review and accept or reject incoming proposals from the authenticated recipient seat.
- Cancel outgoing proposals, schedule agreement withdrawal, or break an agreement immediately.
- Offer Helix Technology Exchange proposals with additional compensation.
- Convert Aurelian Political Capital through the network command layer.
- Keep every pending proposal private to the involved civilizations.

### Reliability and privacy

- Atomic room revisions prevent concurrent player actions from overwriting each other.
- Spectators receive a public projection with all Hidden Legacy cards, private surveys, proposals, sealed Orders, pending Labor, and bot analysis removed.
- Bot-controlled capture bookkeeping resolves automatically.
- New tests cover authenticated military commands, diplomacy ownership, privacy, stale revisions, and network room publication boundaries.

This remains an alpha release. Account recovery, matchmaking, room chat, and asynchronous notifications remain future milestones.
