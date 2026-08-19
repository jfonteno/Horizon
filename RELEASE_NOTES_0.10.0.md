# Horizon 0.10.0

## Visual Map Overhaul

- Increased the canonical rendered board from 710 to 980 pixels before zoom.
- Added Fit, Center, zoom controls, scroll navigation, and drag panning.
- Added dedicated generated artwork for every tile kind, including the neutral unrevealed state and optional visual-library hazard art.
- Added a layered tile renderer that keeps artwork, ownership, units, labels, and state effects independent.
- Added 18 distinct scalable vessel silhouettes covering the complete standard, faction, civilian, and Exploration roster.
- Added lead-vessel fleet markers with carrier count and total CU.
- Added vessel icons to Fleet Operations, construction, and faction-unit lists.
- Added authorized Farbound private-survey artwork without exposing underlying hidden tiles to other views.
- Centralized visual asset paths and icon types in the theme asset library.
- Preserved schema 9 save compatibility because this patch changes presentation only.
