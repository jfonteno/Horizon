# Horizon 0.34.8: Faction Engines

## Rules

- Wayfarers start with 2 Influence in addition to their existing resources. Migrating an Arkship through three distinct hexes earns 3 LP from the new **Arkship Voyage** Civilization objective.
- The starting Salvo Bombard Frigate moves three hexes per Turn. Bombardment still targets a hex, prioritizes the fewest CU, then lower vessel capacity and movement, and cannot remove a force's final CU. Bombardment 2 still requires a stationary Siege Cruiser.
- At Policy II, Aurelians may offer Influence in direct trades. They may spend 2 Influence for 1 Material, Currency, or Research at the System Market. **Influence Broker** awards 4 LP after accepted Influence trades with three distinct civilizations; **Political Exchange** awards 5 LP after 8 Influence has been spent at the Market. Other civilizations may receive and spend traded Influence but cannot offer it in a new trade.

## Bot priorities

- Spires pursue an explicit Arcology project: permanent Material and Research Centers, Resource IV, a Metropolis, an Arcology, and six economic Centers. Their bot delays some early Gate spending while bootstrapping, favors a second Material source over duplicating Research, uses surplus Currency for a missing input, and avoids unrelated technology and military purchases until the engine matures unless threatened.
- Wayfarers emphasize mobile production, a second mobile Habitat, then Exploration technology. Their migration route now has a separate early scoring objective.
- Salvo bots value Bombardment and move a Bombard Frigate toward a known safe firing position. They remember its previous hex to reduce pointless backtracking when no target is yet visible.
- Aurelian bots use Influence trades and Market exchanges when they can afford them while protecting a Gate reserve.

## Emperor bot comparison

Thirty-three games per format used the same 16 Turn, all Emperor rotation and seed ranges used for the preceding faction audit: four players at 39100–39132 and six players at 39200–39232. Every faction appeared 12 times in the four player set and 18 times in the six player set.

| Faction | 0.34.8 LP, 4 players | 0.34.8 LP, 6 players | Observed Civilization objectives |
| --- | ---: | ---: | --- |
| Spires | 14.3 | 11.6 | Urban Core 11/12 and 17/18; Resource IV reached 1/12 and 2/18, with one Arcology Civilization claim |
| Wayfarers | 14.6 | 17.2 | Arkship Voyage 11/12 and 16/18; Wandering Civilization 6/12 and 15/18 |
| Salvo | 11.2 | 13.9 | Fire Mission 2/12 and 6/18; one Superiority claim |
| Aurelians | 19.6 | 19.6 | Political Exchange 6/12 and 11/18; Influence Broker 1/12 and 7/18 |

The Gate succeeded in **28/33** four player and **33/33** six player games. Against the preceding 0.34.7 audit, the new objectives gave Wayfarers and Aurelians clear scoring routes, especially in larger games. Spires' Resource progression improved, but its LP fell from about 16.8 to 14.3 in four player games and 13.3 to 11.6 in six player games. Salvo also fell from about 16.9 to 11.2 and 15.3 to 13.9. Spires rarely finishes the entire Arcology chain in a 16 Turn game, and Salvo does not yet exploit combat reliably. These remain AI tuning priorities, rather than solved balance claims.

## Verification and deployment

Focused tests cover Influence exchange and trade ownership, the two Aurelian objectives, Arkship movement scoring, and three-step frigate movement. The full test suite, typecheck, and standalone self-hosted build were run. Existing rooms and commander data need no migration. Keep the server's `data` directory while replacing application files; the release archive excludes live data and backups.
