# Horizon 0.20.1

Horizon 0.20.1 is a focused board and network interaction patch.

## Standard Board

- Expanded the Standard Board from side length 5 to side length 6.
- The new regular hex contains 91 playable hexes in an 11 by 11 rendering grid.
- Rebalanced the random tile pool for the larger play area while retaining the no-Hazards rule.
- Added balanced starting configurations for four, five, and six civilizations.
- Updated both local and network map rendering for the larger grid.
- Existing 61-hex rooms and saves automatically use the retained legacy geometry instead of changing shape midgame.

## Vessel interaction

- Exploration and Colony Ships now respond when clicked during Negotiation as well as Orders.
- Clicking a friendly vessel always opens its contextual action card.
- Movement and other Order actions remain disabled until the Orders phase begins.
- The vessel card clearly exposes Move, Establish Habitat, scanning, and Hold actions when applicable.

## Compatibility

- Native Windows hosting and Cloudflare Tunnel configuration are unchanged.
- Existing 0.17 through 0.20 room data remains supported.
