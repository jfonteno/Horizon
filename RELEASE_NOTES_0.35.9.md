# Horizon 0.35.9 playtest patch

- Keeps movement range at zero when a selected vessel is out of moves or has disappeared during a room update. A missing fleet member cannot leave a stale route active.
- Rejects orders naming an Exploration vessel that no longer exists, instead of applying them to another vessel. Older orders without a vessel ID still select the primary vessel.
- Safely handles a post-combat redistribution prompt whose vessel list changed before the player clicked it. The panel asks for a room refresh instead of crashing.
- Clears a pending route when selecting an uncommanded unit from the Orders list.

Includes all changes from 0.35.8, 0.35.7, and 0.35.6. Existing room and commander data can be retained during the update.
