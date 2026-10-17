# Horizon 0.33.10

## Aegis Blockade Logistics

- Moved the Blockade Deployment Vessel and Blockade Platform construction to Military II.
- Blockades now begin deployed in the Habitat hex where they are built.
- Added separate Blockade cargo to every military vessel. Standard military vessels carry one; the Blockade Deployment Vessel carries three.
- Added Load Blockade and Deploy Blockade Orders directly to the selected vessel controls.
- Loading or deploying requires the vessel to hold position for the Turn. Loaded Blockades are inactive and are lost with a destroyed carrier.
- Added Economy II Security Export. Only Aegis may initiate a sale, while the buyer chooses an eligible controlled deployment hex when accepting.
- Updated Build, Diplomacy, Academy, AI acceptance, persistence normalization, and order validation for the new workflow.

## Compatibility

- Existing 0.33.x rooms remain loadable. Any persisted carried Blockade is normalized to its carrier's owner and location.
- Existing deployed Blockades retain their current owner and hex.
