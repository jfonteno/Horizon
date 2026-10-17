# Adaptive priority validation

The same 27 map seeds (34522 through 34548) were played once for each contender difficulty against three Medium bots. The previous result is in `AI_COMPARISON_0.34.0_additional_27.json`; this version's seed by seed results are in `AI_COMPARISON_0.34.1_priorities_27.json`. Each match ends at the normal game result. LP includes revealed Hidden Legacy points.

| Contender | Previous average LP | Current average LP | Previous wins | Current wins | Previous Gate success | Current Gate success |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Easy | 12.04 | 11.96 | 3/27 | 5/27 | 17/27 | 21/27 |
| Medium | 12.70 | 12.63 | 7/27 | 7/27 | 19/27 | 20/27 |
| Hard | 14.19 | 14.81 | 6/27 | 7/27 | 17/27 | 18/27 |
| Emperor | 14.96 | 14.89 | 6/27 | 7/27 | 16/27 | 18/27 |

Emperor average LP did not improve. Its wins, Gate success, and objective claims did improve slightly in this sample, but it remains far below the desired 22 to 25 LP against Medium. The priority framework improves decision explanations and some openings; it has not yet solved faction objective execution, especially for the low scoring factions. Further work should measure concrete objective progress turn by turn, then tune action sequences instead of awarding artificial points.

The focused tests verify faction priorities, proactive garrison limits, Aurelian Influence investment and Gate contribution, hidden information boundaries, and a complete campaign. The comparison is deterministic AI versus AI, not a test against human players.
