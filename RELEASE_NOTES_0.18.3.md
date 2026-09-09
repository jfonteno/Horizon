# Horizon: Shattered Reach 0.18.3

## Lobby interaction

- Replaces the competing page and card scrollbars with one room-overlay scrollbar.
- Keeps every lobby option reachable on desktop, tablet, and phone layouts.
- Places each player's faction choices and Ready confirmation in one continuous interaction area.
- Adds explicit selected, available, and reserved faction states.
- Preserves unique-faction enforcement and seat-based randomized starting positions.

## Server-authoritative Turn timer

- Lets the host disable the timer or choose a duration from 5 minutes to 4 hours in room settings.
- Stores the timer setting and deadline in the durable room record.
- Shows a live countdown in the Turn status panel.
- Pauses and resumes the remaining time with host room controls.
- Starts the next deadline after Turn resolution, while waiting for mandatory captured-Center decisions when necessary.
- Issues Hold to every civilization without sealed Orders at expiration, then resolves all submitted Orders normally.
- Records automatic timer resolutions in room history, the audit ledger, replay data, and playtest reports.

## Compatibility

- Existing 0.17.x and 0.18.x rooms migrate with the timer disabled.
- Native Windows static asset compatibility from 0.18.2 remains included.
- The dependency lockfile retains esbuild 0.18.20 for clean Windows installations.
- No Cloudflare Tunnel changes are required.
