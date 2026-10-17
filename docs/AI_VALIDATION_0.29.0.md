# Horizon 0.29.0 AI validation

0.29.0 implements a shared strategic model for Legacy planning, threat-aware
diplomacy, bounded counteroffers, faction economy, military task forces, and
Gate scheduling. It is a playable strategy release. The measured results do
not yet establish consistently excellent play across maps and seat counts.

## Release checks

- 181 automated tests pass, including 12 new AI scenarios and a five-game
  deterministic strategic regression.
- Typecheck, lint, application readiness, and content validation pass.
- Production and standalone builds are checked separately.
- The standalone production server is exercised by the Windows compatibility
  tests. Platform-specific signed installers are not produced by this package.

## Five-seed regression

Meta Analyst, Shattered Reach, six Core Set factions in fixed seats, seeds
21000 through 21004, 16 turns each:

| Measure | Result |
| --- | ---: |
| Completed Gates | 4 / 5 |
| Average Gate progress | 17.2 / 18 |
| Hidden objectives completed | 38.3% |
| Civilization claims per player | 0.83 |
| Universal claims per game | 4.6 |
| Rejected planned submissions | 0 |

Every decision is checked for legal submission. A recovered Hold is treated as
a failed planned submission rather than a successful plan.

## Additional diagnostic runs

Three Meta Analyst games with rotating faction seats on Shattered Reach,
six players, seeds 21000 through 21002:

| Measure | Result |
| --- | ---: |
| Completed Gates | 3 / 3 |
| Hidden objectives completed | 36.1% |
| Civilization claims per player | 0.83 |
| Universal claims per game | 3.67 |
| Average LP per player | 12.06 |
| Accepted trades per game | 31 |
| Counteroffers per game | 1 |
| Rejected planned submissions | 0 |

Strategic Director Standard Board smoke checks at seed 21000 completed all 16
turns with legal submissions. The four-player check completed its Gate at
12 / 12; the five-player check remained incomplete at 10 / 15. These single-seed
checks establish execution coverage, not a performance estimate.

## Behavior covered by scenarios

- Plans combine Hidden, Universal, Civilization, and Gate goals.
- Unfavorable trades receive a legal bounded counteroffer.
- Bots reject alliances that strengthen a leading victory threat.
- Reports expose objective progress and public threat analysis.
- Colony Ships establish on their current site and replace missing Modules.
- Era III Technology progress requires the actual scoring conditions.
- Completed Gates release strategic resource reserves.
- Final-Era market support continues after the first Tribute.
- Unanswered counteroffers expire rather than blocking later diplomacy.
- Trade acceptance preserves resources committed to sealed Orders.
- Bots respond to bot proposals during the same turn.

## Next performance work

The main shortfall is Hidden completion. Multi-part objectives still need
stronger prerequisite scheduling, branch-specific Technology investment, and
reliable repeated construction or settlement. Standard Board needs better
early production diversity and coalition resource routing before final-Era
costs arrive. Civilization scoring also varies considerably by faction;
Helix and Foundry need more objective-specific development paths.

The earlier aspirations of 90% Gate survival, 75% Hidden completion, and broad
Civilization/Universal scoring coverage remain targets. They are not claimed
as achieved by this release. The regression floors protect measured behavior
and are distinct from those release-quality targets.

Broader evaluation should cover both maps, 4–6 seats, both expert profiles,
mixed human/bot rooms, faction-seat rotation, and many more seeds. The current
sample sizes are too small to establish faction balance or expert strength.

## Reproduce

```bash
npm test
npm run simulate:ai -- 3 meta-analyst shattered-reach 6
npm run simulate:ai -- 1 strategic-director standard-board 4
npm run simulate:ai -- 1 strategic-director standard-board 5
```

The five-seed test keeps factions in fixed seats; the diagnostic script rotates
them between games. Consequently their results should be compared as separate
datasets rather than averaged together.
