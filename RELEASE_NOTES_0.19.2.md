# Horizon: Shattered Reach 0.19.2

## Contextual map commands

- Opens a focused action menu when a player selects a vessel or hex.
- Offers Move, Establish Habitat, Prospect, Long-Range Survey, Hold, and Farbound Survey only when the selected vessel supports them.
- Opens CU load, station, movement, and Fleet Command actions directly from a selected military vessel.
- Lists stacked friendly and known rival vessels so crowded hexes remain usable.
- Presents construction choices directly on controlled Habitats.
- Validates construction availability and the projected shared Order budget before adding a build.

## Tactical awareness

- Adds a persistent faction scoreboard with LP, contact state, planning state, active agreements, and incoming proposal indicators.
- Opens Diplomacy with the selected faction from the scoreboard or a rival-controlled hex.
- Adds an activity archive containing recent room events and pending proposals.
- Links activity entries that reference a hex back to that map location.
- Adds numbered markers to commanded vessels and Order destinations.
- Makes movement and survey targeting show the selected action, the required next step, and a clear Cancel control.

## Order review

- Adds a pre-seal checklist for Hidden Legacy selection, drafted Orders, projected budget, unused Habitat construction, Horizon Gate participation, and unanswered proposals.
- Numbers the private Order queue to match markers on the map.
- Preserves browser-local private drafts until they are sealed.

## Compatibility

- Existing 0.17.x, 0.18.x, and 0.19.x rooms remain compatible.
- Preserves the complete Network command workspaces, bot diplomacy responses, mandatory Hidden objectives, Turn timers, and native Windows hosting.
- Keeps the corrected esbuild 0.18.20 lockfile.
- Requires no Cloudflare Tunnel changes.
