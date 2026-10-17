# Horizon 0.33.8

## Radial lobby collision correction

- Corrected the faction-selection lobby overlap visible in short desktop viewports.
- Top seats now arrange their controller, player information, and faction circle outward from the central room hub.
- Bottom seats use the inverse arrangement so their faction circle remains nearest the orbit while labels and controls extend toward the lower edge.
- Side-seat positioning, faction selection, Human and Bot controls, and Random bot faction selection are unchanged.
- Added regression coverage for top and bottom seat orientation in addition to the existing desktop and mobile stage-boundary checks.

## Included from 0.33.7

- Complete Build-menu access for all Shattered Reach faction-specific units and upgrades.
- Direct Aegis Blockade deployment and accessible Blockade sale controls.
- Wayfarer mobile construction targeting, Salvo artillery construction, Spires Arcology access, and Guild Factory controls.

## Compatibility

- Existing 0.33.x rooms and Commander profiles remain compatible.
- No account, room, or content schema migration is required.
