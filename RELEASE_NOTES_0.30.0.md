# Horizon 0.30.0: Connected Command

Horizon 0.30.0 adds the communication and negotiation layer needed for coordinated online play, then makes the Command Board quieter and easier to scan.

## Multiplayer communication

- Every network room has persistent All Chat and a server-authored system feed.
- Players can open private direct messages or private group conversations with other human commanders.
- Unread counts survive reconnects and appear on conversations, room attention, and the Messages command.
- Messages can reference a current proposal or map hex without exposing private game state.
- Channel muting and player blocking are private per-player preferences.
- Reports retain nearby message context for a host-only review queue. Hosts can dismiss a report or remove the reported message.
- Message length, attachment validation, link restrictions, and per-player rate limits are enforced by the authoritative room server.
- Spectators do not receive room chat, and direct or group messages are projected only to their participants.

## Gate coordination

- The Messages workspace includes a public Gate Coordination view.
- Each civilization can publish, update, or clear its intended Tribute for the current Turn.
- Pledges are planning signals only. A Tribute still requires a valid sealed Order.
- Bot pledge indicators follow the Tributes in their current Order submissions.

## Trade negotiation

- Human players can counter an incoming trade from the Diplomacy workspace.
- Counteroffers atomically reject their parent and preserve an inspectable negotiation history.
- Counter chains are limited to three rounds to prevent loops.
- Trade terms cancel overlapping quantities before validation and evaluation. A proposal can no longer give and request the same resource as a meaningless exchange.
- AI negotiators search for legal, incremental improvements, respect actual resource inventories, and avoid permanent Labor transfers without the required relationship.
- Diplomatic proposals and bot responses appear as structured references in the appropriate direct conversation.

## Command Board cleanup

- Map name, seed, region, and selection details now sit over the map instead of consuming a separate header row.
- The selected hex summary is compact and anchored to the map edge.
- Activity, Connection, and Exit Room controls share one height and use distinct visual treatments.
- Academy now uses its own icon instead of duplicating Orders.
- The redundant Select a Vessel or Hex prompt beside the zoom controls has been removed.
- The Messages workspace adapts to desktop and mobile layouts.

## Compatibility

- Existing rooms are upgraded to room schema 7 when loaded.
- Existing trade proposals are normalized during room migration.
- Existing room, account, map, and game-state persistence remains compatible.

## Verification

The release includes automated coverage for chat persistence and privacy, blocking, group membership, report review, host moderation, Gate pledges, trade normalization, counteroffer chains, and AI trade evaluation, in addition to the existing full test suite and production validation pipeline.
