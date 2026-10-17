# Horizon 0.34.2: Gate planning and objective feedback

Bots now use the game's production forecast when evaluating recurring resources, including technology effects. Their Gate plan estimates each civilization's affordable contributions across the remaining Turns, identifies resource deficits across several Era costs, and protects future Tribute resources when evaluating purchases. The forecast remains an estimate; rival sealed Orders and future trades are unknown.

The bot's market and diplomacy decisions can address later resource shortages as well as the current Era's cost. It can prepare for the next Tribute after already contributing in an Era. Early Centers that establish independent output in a missing resource receive priority. Aurelian opening investments still get room before their first Tribute when the deadline permits.

Hard and Emperor bots also compare candidate Orders with actual progress toward their selected Hidden, Civilization, and Universal objectives. This rewards measurable progress and avoids repeatedly rewarding fleet moves solely for carrying a generic objective tag. The existing difficulty choices, game rules, scoring rules, and save format are unchanged.

## Repeatable comparison

The same 27 seeds (34522–34548), four-player Shattered Reach lineup, and three Medium opponents per contender were run for each difficulty. The baseline is 0.34.1; `docs/AI_COMPARISON_0.34.2_gate_27.json` records all 108 updated games and per-game samples.

| Bot | Gate survival, before → after | Average LP, before → after | Average Civilization/Universal claims, before → after | Wins, before → after |
| --- | --- | --- | --- | --- |
| Easy | 21/27 → 23/27 | 11.96 → 11.15 | 0.93 → 1.04 | 5 → 3 |
| Medium | 20/27 → 24/27 | 12.63 → 12.56 | 1.22 → 1.11 | 7 → 4 |
| Hard | 18/27 → 24/27 | 14.81 → 13.67 | 1.74 → 1.15 | 7 → 3 |
| Emperor | 18/27 → 24/27 | 14.89 → 14.44 | 1.78 → 1.30 | 7 → 5 |

There were no failed bot submissions in these 108 games. Gate survival improved, but objective claims and wins fell at higher difficulties. Emperor is still well short of the desired 22–25 LP against Medium opponents. The next AI pass should target complete, affordable Civilization and Universal objective sequences, particularly when the shared Gate is already on track. This release should not be described as an overall bot-strength increase based on this comparison.
