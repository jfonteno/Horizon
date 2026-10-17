# Horizon 0.21.0

This release addresses feedback from the first online playtest and retains the 0.20.4 map controls, faction rules, and private Farbound Forward Scan fixes. Hazards remain excluded.

## Planning and feedback

- A horizontal bottom bar shows the current Order queue, including sealed Orders. Remove individual draft Orders or open the full review panel.
- Unseal Orders restores the submitted queue for editing while the current Turn is still open. Resolved Turns cannot be reopened this way.
- Construction selections have queued counts, highlighted buttons, named feedback, and individual removal controls.
- Queue multiple builds at the same Habitat, limited by the shared resource/Labor budget, technology, and Center capacity. Successive Habitat upgrades use their correct costs.
- Selected hexes display production and installed Centers.
- Turn changes display a dismissible notification. Technical successful-command receipts no longer occupy the board; errors remain visible.
- Command navigation uses pictograms. A hideable suggestions panel offers state-based planning hints.
- Exploration Technology descriptions explain Survey Vessels for all factions and later movement/scan improvements.

## Rules and reporting fixes

- New military vessels without CU remain docked instead of disappearing when activated. Loading CU makes a ready vessel movable. Economic Salvage preserves unrelated docked hulls.
- Helix Technology Exchange checks the combined exchange and compensation cost before spending, displays that total, and respects the one-advance-per-Turn limit.
- A guest can seal first without resetting submission order.
- New games evaluate Hidden objectives at each Era end but bank their points privately until final scoring. Existing games retain their previous scoring mode. Other players and spectators see the archive only after the game ends; host diagnostic exports still contain authoritative game data.
- The Gate panel shows contributions by faction and Era, plus detailed receipts for contributions made under 0.21.0.
- History snapshots record resolved scoring. Trade graphs use cumulative trade metrics, and the final graph point is reconciled against the final game state.

## Upgrade

1. Stop the old Horizon server.
2. Extract this package into a new folder.
3. Copy your existing `data` folder into the new folder if retaining rooms or content packs. Keep a backup.
4. On Windows, run `Start-Horizon-Windows.cmd`. Other self-hosted installations should install dependencies, run `npm run build:self-hosted`, and restart using their existing configuration.
5. Reload clients. Cloudflare Tunnel routing does not change.

Historical deleted vessels cannot be reconstructed, and older intermediate graph samples or detailed Gate receipts cannot be recovered retroactively.

## Validation

Production build, lint, TypeScript checks, automated rule and room tests, and the native-Windows production asset regression were exercised. The automated suite includes multi-build budgets, crew activation, salvage, technology costs, Hidden privacy, final history, Gate receipts, and unsealing. Visual browser verification was unavailable because the browser service blocked access to the local workspace server. Windows itself was not available; its static-asset compatibility path is covered by the production regression.
