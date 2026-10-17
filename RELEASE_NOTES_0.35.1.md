# Horizon 0.35.1 playtest patch

## Salvo targeting and movement

- An artillery vessel can move and fire Bombardment 1 in the same Turn. Its firing range is evaluated from the destination after movement resolves. Bombardment 2 still requires the vessel to remain stationary.
- Select any non-rift hex in Bombardment range, whether it contains a known enemy force or not. This includes unrevealed hexes and enemy Habitats. Military IV spotter requirements still apply at extended range.
- Fleet movement resolves before Bombardment. Hostile Combat Units that arrive in the selected hex can be hit, including units stationed at a Habitat. A shot with no eligible hostile Combat Units logs the miss and consumes the action without counting toward Salvo scoring objectives. Existing limits on damage per hex and preserving the final CU remain in effect.
- The map action no longer disables Bombardment when there is no currently visible target. Selecting movement first previews shots from the planned destination. Changing a drafted movement destination removes a shot that would become out of range.
- Salvo bots now look for a shot after planning artillery movement and prefer stable Habitat garrisons when choosing among targets.

## Verification

Targeted gameplay and bot regressions: 35 passed. Eight paired full games completed without failed bot submissions or Gate failures. Bot Bombardment orders increased from 20 to 30 in those games, but successful hits increased only from 2 to 3; further tactical tuning is still needed. No change was made to Exploration research priorities.
