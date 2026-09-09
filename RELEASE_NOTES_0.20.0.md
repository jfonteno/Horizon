# Horizon 0.20.0

Horizon 0.20.0 implements the consolidated playtest rules, excluding Hazards by design.

## Game formats and board

- Select four Eras and 16 Turns or five Eras and 20 Turns.
- Gate requirements use `(Eras - 1) x players`.
- Added the canonical symmetric 61-hex Standard Board for four to six players.
- The five Hazard slots are Empty Space in this release. Imported Hazard tiles also become Empty Space.
- Existing rooms and saves remain four-Era games.

## Turn structure and actions

- Added an explicit Negotiation Phase before secret Orders.
- Turn timers cover the complete Turn and issue Hold for unsubmitted Orders at expiration.
- Added constructible Exploration, Survey, Deep Survey, and Pathfinder vessels.
- Added multihex path movement, revealed-route validation, adjacent public scanning, and per-vessel reveal limits.
- Added Farbound Forward Scan, Discovery Dividend, and Frontier Legacy handling.
- Civilian and Exploration vessels caught by hostile military forces are destroyed.
- Surviving Combat Units can be redistributed after combat within vessel Capacity limits.
- Defensive Pact co-stationing and Aurelian Envoy hosting now require explicit directional permission.

## Economy and factions

- Resource IV doubles printed Homeworld output as well as Habitat economic output.
- Varkesh may choose Material or Currency for the next Homeworld Production.
- Farbound may choose Research or Currency for the next Homeworld Production.
- Labor Capacity may be traded down to zero.
- Meridian Economic Salvage may remove CUs from Habitats or military vessels.
- Newly established Habitats retain their original founder for capture and Legacy rules.

## Legacy and endgame

- Added five Universal Legacy objectives per Era.
- Added the complete ten-card Hidden Legacy pool for Era V and updated Era III thresholds.
- Added five Civilization Legacy objectives for every core faction.
- Expanded historical metrics for combat opponents, trades, Habitat development, public reveals, Brokerage, and Frontier Legacy.
- Endgame scoring, charts, AI Gate planning, reports, and server validation now follow the selected format.

## Compatibility

- Save schema 15 migrates prior local saves and persistent network rooms.
- Native Windows static asset compatibility remains included.
- Cloudflare Tunnel configuration does not need to change.
