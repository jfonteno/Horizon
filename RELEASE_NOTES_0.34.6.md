# Horizon 0.34.6: Persistent bot projects

## Changes

- Medium, Hard, and Emperor bots select durable faction and universal Legacy projects. Each project has ordered milestones, an estimated resource and Labor budget, a Turn estimate, and a deadline. A completed milestone advances the plan; unfinished commitments carry into the next Turn.
- The bot scores legal Orders for the next project step and for prerequisites that prepare later steps. Missing inputs direct construction and trade requests. A second funding check accounts for the cost of a Center needed to produce a missing resource. The Gate reserve remains part of the budget.
- Faction plans cover concentrated Spires development, Aegis defenses and Blockade sales, Wayfarer caravans, Salvo bombardment, Guild enhancements, Helix research, Foundry industry and Prospect, Aurelian agreements, Meridian trade partners, Farbound surveys, and Varkesh garrisons. First Foundations and Renaissance are tracked as universal projects. The existing Hidden Legacy planner remains active alongside these projects.
- Shattered Reach objectives expose partial progress before claiming LP, giving the bot credit for real intermediate board states. Aurelian Concert of Worlds now uses the available rival count in a four-player game.
- Salvo artillery navigates toward firing positions and can complete multi-Turn Fire Mission objectives. A stranded Colony Ship receives its replacement Module before a competing homeworld build. Bots also give practical priority to replacing lost Explorers and constructing unlocked faction structures.
- Decision reports show the current project step, remaining budget, funding shortage, and route. No room or commander data migration is required.

## Matched stress comparison

The same 33 four-player Shattered Reach seeds ran with all Emperor bots under 0.34.5 and this patch. Every game lasted 16 Turns; the simulations grant no resource bonuses or hidden rival information.

| Measure | 0.34.5 | 0.34.6 |
| --- | ---: | ---: |
| Average LP per bot | 17.52 | 18.56 |
| Faction objective claims | 80 | 103 |
| Total Gate Tributes | 389 | 399 |
| Games with successful Gate | 26/33 | 28/33 |
| Failed Order submissions | 0 | 0 |

The average still falls short of the desired 22–25 LP and remains a bot-versus-bot result. Aegis completes few faction objectives and some factions depend strongly on early Currency access. These need further focused work before claiming Emperor can match a strong human player.

On a separate 16-game, six-player holdout, all 16 Gates succeeded, bots averaged 17.80 LP, and no Order submissions failed.

## Verification

- Full test suite, including four project regression tests, passed. Typecheck and the standalone self-hosted production build passed.
- The stress harness and project trace scripts are included under `scripts/` for reproducible follow-up runs.
- The release archive excludes the live `data` and `backups` directories. Preserve the existing data directory when updating a self-hosted server.
