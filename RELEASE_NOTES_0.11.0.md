# Horizon: Shattered Reach 0.11.0

## Meta Analyst AI

- Adds human or AI control per seat and supports complete autonomous games.
- Adds a profile-driven AI engine with external JSON personalities under `bots/profiles`.
- Ships the expert Meta Analyst profile with candidate generation and bounded beam search across legal Turn actions.
- Evaluates exact combat, public two-Turn threats, counterfactual retaliation, resource reserves, faction synergies, Legacy progress, Gate pace, and incoming diplomacy.
- Automatically chooses mandatory Hidden objectives, seals Orders, resolves bot capture choices, and advances the full 16-Turn cycle.
- Adds privacy-aware decision reports. Rival secret Orders, unrevealed worlds, and Hidden objectives are never supplied to the planner.
- Adds deterministic AI tests and a reusable multi-seed batch simulation command.

## Compatibility

Existing local saves migrate to schema version 11. Migrated seats remain human-controlled until explicitly configured in a new game.
