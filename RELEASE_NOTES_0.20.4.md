# Horizon 0.20.4

Horizon 0.20.4 is a faction-ability and Turn-flow integrity patch.

## Unified Turn planning

- Network players may negotiate, take immediate actions, draft Orders, and seal Orders while the Turn is labeled Negotiation.
- The interface no longer requires a separate Begin Orders action before submission.
- The server accepts a valid sealed submission from either the Negotiation or Orders state.
- The first submission still moves the authoritative protocol into sealed Orders handling, preserving simultaneous resolution and private submissions.
- Existing saves that are in Negotiation remain in that state when loaded.
- The Turn timer still assigns automatic Hold Orders and resolves normally when it expires.

## Farbound Forward Scan

- The map context action now checks `forwardScanUsedTurn` instead of the unrelated Negotiation Survey flag.
- Forward Scan requires a ready Exploration vessel.
- Already archived survey targets are rejected without consuming the once-per-Turn ability.
- A valid scan records the true hex kind in the Farbound player's private archive without publicly revealing the hex.
- Opposing players and spectators continue to receive an unrevealed placeholder for privately scanned hexes.
- Private scan information remains protected through server projection, room synchronization, and sealed Order resolution.

## Faction integrity coverage

Automated coverage now verifies the connected rules for all six core factions, including:

- Varkesh vessel discounts, Corvette and Xebec unlocks, Conquest Doctrine, and Glory in Battle.
- Helix Technology discounts, Research Center costs, and Technology Exchange.
- Foundry starting infrastructure, Labor-free Habitat Modules, and Prospector operations.
- Aurelian Political Capital, agreement Influence, Envoy movement permissions, and hosted-trade bonuses.
- Meridian free first Trade Agreement, Brokerage, and Economic Salvage.
- Farbound flexible production, Discovery Dividend, Forward Scan, Survey Exchange, Long-Range Survey, surveyed settlement rewards, and Frontier Legacy.

## Compatibility

- Existing 0.17.x through 0.20.3 rooms remain loadable.
- Existing maps and room geometry are unchanged.
- No Cloudflare Tunnel or deployment configuration changes are required.
