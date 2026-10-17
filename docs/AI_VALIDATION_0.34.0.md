# AI validation for 0.34.0

The benchmark scripts use fixed seeds and legal 16-Turn matches. `benchmark-ai-0.34.0.ts` rotates all eleven factions and all four AI levels through 44 mixed matches. `compare-ai-0.34.0.ts` holds three Medium rivals fixed and varies the fourth seat across levels for the same seed and faction. These are AI-versus-AI checks, not evidence of human-equivalent skill. Raw metrics are in `AI_VALIDATION_0.34.0.json` and `AI_COMPARISON_0.34.0.json`.

In the controlled 22-seed comparison, the tested seat averaged 11.27, 11.36, 12.00, and 12.77 public LP from Easy through Emperor. Gate survival was 64%, 77%, 77%, and 82%. Win counts were 3, 3, 2, and 4, so the sample does not establish a monotonic win rate. All four levels had zero failed Order submissions. Mixed bot matches were less consistent because the Gate is cooperative and factions have large performance differences.

Checks include: all new profiles load, difficulty is saved independently for each seat, only a host can change it, a mixed game completes without invalid Orders, and a rival Hidden choice never enters the Emperor opponent model.

Measure competitive quality with human playtest results by faction, map, player count, and Gate survival. Prioritize weaker faction objectives and diplomacy behavior before claiming the level labels represent consistent win probabilities.
