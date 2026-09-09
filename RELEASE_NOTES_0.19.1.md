# Horizon: Shattered Reach 0.19.1

## Map-first Network interface

- Replaces the permanently expanded Network side panel with a compact collapsible command dock.
- Uses clear command symbols and labels while expanded, with a narrow icon-only state when collapsed.
- Removes the permanent right rail to give the tactical map substantially more room.
- Moves standings and Turn status into a header popover.
- Keeps spectator update controls in a small floating control strip.

## Full command workspaces

- Opens Diplomacy, Legacy, Economy, and Technology in full-width workspaces over the tactical map.
- Provides one large scroll surface for each information-heavy system.
- Expands diplomacy and objective layouts into responsive multi-column views on desktop.
- Preserves a persistent Return to Map control.

## Diplomacy attention and bot responses

- Displays a prominent clickable alert whenever a human player has one or more pending proposals.
- Opens the Diplomacy workspace directly from the alert.
- Lets bots immediately evaluate human trade, agreement, and Technology proposals.
- Uses resource scarcity, strategic priorities, Gate needs, available Influence, and risk tolerance in bot decisions.
- Reports whether the bot accepted or rejected the proposal.

## Mandatory Hidden Legacy selection

- Opens a blocking private objective selection screen at the beginning of every Era.
- Prevents human players from using other server actions until an objective is selected.
- Continues to allow mandatory captured-Center bookkeeping when applicable.
- Keeps Hidden objective choices private to the authenticated player.

## Compatibility

- Existing 0.17.x, 0.18.x, and 0.19.0 rooms remain compatible.
- Includes the complete Network action coverage introduced in 0.19.0.
- Preserves native Windows hosting, the corrected esbuild 0.18.20 lockfile, lobby faction selection, and Turn timers.
- No Cloudflare Tunnel changes are required.
