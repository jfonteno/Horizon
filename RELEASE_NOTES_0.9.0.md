# Horizon 0.9.0: Sealed Orders and Era Scoring

## Added

- Private order drafting and pass-the-device handoff for every civilization.
- A simultaneous batch resolver with a fixed deterministic resolution sequence.
- Simultaneous movement, opposing edge-crossing combat, and multi-force hex resolution.
- Secret vessel, faction, construction, Technology, and Gate Tribute Orders.
- Era IV support for multiple Tribute Orders from one civilization when it can pay them.
- Private room projection that removes other civilizations' sealed submissions.
- Resolution reports describing the previous Turn's public results.

## Rules changed

- Orders have no effect until every civilization has sealed its submission.
- Hidden Legacy completion remains concealed and awards no LP during the Era.
- Hidden Legacy cards score and reveal only during the Era-end resolution.
- Valid simultaneous Gate Tributes all pay and gain personal credit, even when the shared Gate reaches its cap.

## Compatibility

Version 0.9.0 migrates previous local saves to schema version 9. Existing diplomacy, fleets, faction operations, Legacy cards, Gate progress, private information, map state, and scores remain intact. Migrated games begin in Negotiation with no pending sealed Orders.

Remote room seats remain read-only in this patch. The order protocol is now part of shared game state so future server-validated remote submissions can use the same deterministic engine.
