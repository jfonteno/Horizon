# Horizon 0.35.0: Gameplay balance playtest

This patch starts a rules and balance experiment. It changes gameplay and adds only the small controls needed to exercise new Orders. The technology tree and broader information layout are reserved for a separate interface pass.

## Rules to test

| System | Playtest rule |
| --- | --- |
| Military mobility | Add 1 movement at Military II, 2 at III, and 4 at IV to each military hull's printed movement. A starting hull receives the correct bonus on Turn 1. |
| Exploration tempo | Exploration Technology adds level minus one movement to a hull's printed movement. One vessel may publicly reveal up to 1, 2, 3, or 4 unknown hexes per Turn at Exploration I to IV, including hexes on a single move path. The complete route is checked before it is sealed or resolved. |
| Anomalies | First discovery resolves a seed-stable, one-time reward: two units of a resource, reveal adjacent hidden hexes, or one LP. The reward and discoverer persist in saves. |
| Spires | Colonies become Arcologies directly at Resource III for 4 Material, 3 Currency, 3 Labor. The Spires no longer need Metropolises for their faction objectives. Old Spires Metropolises migrate into Arcologies. |
| Envoys | Any number of eligible Aurelian Envoys produce exactly one bonus Influence for the Aurelian per completed trade. |
| Exploration IV portal | In Build at the Homeworld, consume a ready Exploration vessel at a revealed destination. The permanent link occupies one Homeworld Center slot. If full, choose a Center to sacrifice. An owned vessel may use one portal edge per Turn. |
| Center removal | Remove or replace a Center as a Habitat construction action. Replacements pay their normal cost. Removal gives no refund. Factory settings and Enhanced Center indexes are preserved correctly after reindexing. |
| Galactic Policies | Three Delegate Dawn cards appear in each of Eras I to IV. Players may secretly bid any affordable Influence in the first Turn's sealed Orders or abstain. All bids are spent. A unique highest total enacts a policy for the Era; a tie or zero bids enacts none. Votes are public after resolution. The twelve playtest card effects are connected to trade, agreements, construction, Technology, recruitment, combat, and Gate Tribute resolution. |
| Military Legacy | Three new Universal objectives reward a first Habitat conquest, an owned Habitat successfully defended, and victories over two different civilizations. |
| Conquest | A player receives one of the captured Habitat's primary resource once for that Habitat. Homeworld rewards use the previous owner's last selected Homeworld production resource. |
| Salvo | Bombardment range is 1 at Military I, 2 at II, 4 at III, and 7 at IV. Beyond 4, a friendly spotter must be at or adjacent to the target. A Siege Tender can add one range to one shot each Turn. Damage and the final-CU protection remain in place. |

## Delegate Dawn timing

This digital playtest casts votes in sealed Orders. The winning card begins at the first Turn's resolution. Thus an Era's first Negotiation phase precedes the vote result. In particular, Era I trade and agreement discounts can first affect subsequent Negotiation phases. This timing should be evaluated before the rules are locked.

The cards and uncapped voting procedure are taken from *Horizon_Deligate_Dawn_Expansion_Playtest_Edition*. Its four new factions and expanded Hidden Objective deck are outside this gameplay pass.

## Suggested balance checks

1. Compare Gate completion, LP by faction, military captures, and Era length to 0.34.8. Pay special attention to Military IV's four extra movement and Salvo's long-range pressure.
2. Track how often each anomaly reward triggers and whether early resource windfalls change Center openings.
3. Measure Spires Resource III and first Arcology Turn against its 3 to 7 LP objective progression.
4. Count portal openings and Center sacrifices, and check whether a portal creates too much conquest reach.
5. Compare Influence reserves, policy enactment frequency, tied votes, and which cards see meaningful use.

## Verification

Rules regression, faction behavior, room migration, and mixed bot campaign tests run through the dependency-free Node TypeScript loader. This workspace does not contain installed npm dependencies, so the full Next/vinext production build and TypeScript typecheck were not run here. Run `npm ci`, `npm run typecheck`, and `npm run build:self-hosted` on the self-hosted machine before replacing a live playtest server.
