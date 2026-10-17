# Horizon 0.32.2: Map-First Faction Actions

Version 0.32.2 resolves the first closed-beta interaction notes for the Shattered Reach factions and improves information access across the command board.

## Faction controls

- Wayfarer Arkships, Grand Arks, and Worldships have larger unique map silhouettes. Selecting one exposes highlighted Migration destinations and mobile-only Center or Caravan Guard construction.
- Farbound Forward Scan lives on the selected Exploration vessel, may be issued alongside movement, and renders a private translucent sector tile only in the owning player's view.
- Salvo artillery exposes Bombardment from the selected vessel. Siege Cruisers can choose strength 1 while retaining movement or strength 2 while holding position. The server rejects conflicting movement and strength 2 Orders.
- Aegis Blockades use a unique owner-colored platform icon. Open Borders allows harmless passage, hostile passage invokes platform combat, and Blockade-only combat does not grant Varkesh Glory.
- Wayfarer Deep Recon and Aegis Blockade gifts are also available from their selected map assets.

## Interface

- Civilization cards open Diplomacy first and show Material, Currency, Research, Influence, Labor, and LP.
- Diplomacy includes a bottom status summary for the selected civilization.
- A collapsible resource tab remains accessible over the map.
- The First Horizon Academy launch is centered and visually prominent.
- Future Content now opens a dedicated page for each expansion with faction-by-faction identity summaries.

## Verification

Regression coverage verifies combined Farbound movement and scanning, stationary Bombardment 2, mobile construction away from permanent Habitats, private survey projection, Open Borders Blockade passage, and Glory suppression.
