# AI engine

Horizon keeps bot personalities outside the rules engine. `bots/profiles/*.json` files contain weights and planning limits, `bots/schemas/bot-profile.schema.json` documents the extension contract, and `game/ai` contains the shared planner. Vite discovers valid profiles when the application starts, so adding another profile does not require editing the game engine.

## Decision pipeline

1. Project the authoritative state through the same private-view boundary used for a player seat.
2. Choose the mandatory Hidden Legacy objective using LP, current progress, faction affinity, automation risk, and Era feasibility.
3. Review incoming diplomacy and propose legal reciprocal trades or Trade Agreements when resource ledgers are complementary.
4. Build a two-Turn public threat map and calculate exact combat strength for every reachable engagement.
5. Generate legal candidates for exploration, settlement, fleets, faction vessels, construction, Technology, and Gate Tributes.
6. Score candidates using the profile's Legacy, economy, expansion, military, denial, survival, diplomacy, and Gate priorities.
7. Search compatible candidate bundles with bounded beam search while enforcing unit conflicts, one-use actions, purchase affordability, resource reserves, and Gate-resource preservation.
8. Seal the chosen Orders through the normal submission rules and record a privacy-aware decision report.

The engine is deterministic for the same game state, seed, seat, and profile. It does not inspect rival sealed Orders, rival Hidden objectives, or unrevealed world contents. Reports preserve those secrets until the normal resolution or Era-scoring reveal.

## Adding a bot

Copy `bots/profiles/meta-analyst.json`, assign a unique lowercase `id`, adjust the planning and priority values, and validate the file against `bots/schemas/bot-profile.schema.json`. Restart Horizon and the new controller appears in seat setup.

Profiles tune a shared reasoning engine. A future bot that requires new candidate types, memory, negotiation protocols, or search algorithms should add an implementation module under `game/ai` and keep its personality data under `bots`.
