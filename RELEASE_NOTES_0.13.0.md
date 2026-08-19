# Horizon: Shattered Reach 0.13.0

## Strategic Mind

- Adds a rolling four-Turn strategy forecast for production, Gate deadlines, reserves, resource deficits, coalition capacity, and victory pressure.
- Replaces uniform faction bonuses with explicit strategic doctrines for all six civilizations.
- Adds opponent archetypes derived only from public LP, military, Habitat, aggression, trade, and Gate behavior.
- Adds contribution schedules and dynamic per-resource reserves that protect both the current Tribute and the next planned contribution.
- Adds Gate-emergency behavior when projected collective capacity falls below the profile's confidence threshold.
- Improves coalition diplomacy through targeted resource gifts, reciprocal deficit trades, early Trade Agreements, and Labor-backed exchanges.
- Uses Aurelian Political Capital, Meridian Brokerage and Economic Salvage, Helix Technology Exchange, and Farbound Survey Exchange during autonomous play.
- Adds leader pressure and kingmaking avoidance to military target evaluation.
- Expands AI reports with doctrine, forecast capacity, personal deadlines, resource priorities, commitments, opponent archetypes, and meta-game warnings.
- Expands self-play statistics with contribution fairness, reserves, Habitats, trades, Technology, military strength, and search performance.

## Compatibility

Existing local saves migrate to schema version 13. Earlier bot reports remain readable and are labeled as predating the four-Turn forecasting model. Existing game history, spectator simulations, diplomacy, objectives, fleets, resources, and scores remain intact.

## Self-play validation

Across 100 deterministic six-faction games using seeds 21000 through 21099, Meta Analyst averaged 16.32 of 18 Gate Tributes and completed the Gate in 50 games. Version 0.12.0 averaged 11.9 Tributes and completed the Gate in 3.3 percent of its 30-game validation set. The full result is retained in `AI_BENCHMARK_0.13.0.json`.

Meridian won 27 of the 50 successful games. This is retained as a visible faction-balance signal rather than hidden through AI handicapping.
