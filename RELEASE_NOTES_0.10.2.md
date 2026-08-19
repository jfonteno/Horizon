# Horizon 0.10.2

## Large Map Turns

- Enlarges the standard map canvas to make exploration feel more expansive while preserving zoom and pan controls.
- Corrects the backend hex-neighbor table so every visually adjacent odd-column hex is a reciprocal legal neighbor.
- Opens Market, Diplomacy, Legacy, and faction negotiation controls during every active civilization's private Orders turn.
- Makes **Submit Orders & End Turn** hand control to the next civilization and center the map on its home system.
- Preserves secret simultaneous resolution: no submitted Orders execute until every civilization has ended its turn.
- Migrates existing local saves to schema version 10 and the unified turn flow.
