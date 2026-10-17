# Horizon 0.34.5: Bot planning stress pass

## Changes

- Explorers move through revealed sectors toward the next unrevealed frontier instead of repeatedly shuttling between known hexes. Revealed moves no longer receive exploration objective credit.
- Aurelian and Meridian scouts route toward uncontacted rival Homeworlds so diplomatic objectives and trade have reachable partners. Foundry scouts still prioritize Currency specialists. Wayfarers seek Material partners when their fleet has no Material income.
- Bots with no independent Currency production reserve scarce opening Currency, direct flexible Homeworld output toward the first Currency Center, and prioritize its construction before optional spending. The last Turn of an Era still permits a Gate Tribute.
- Wayfarer migration values a revealed Material world when the mobile economy lacks Material. The objective planner now recognizes the tangible progress of constructing another mobile Habitat.
- Emperor's priorities give compounding economy, Technology, diplomacy, and Gate obligations more weight than broad denial. The comparison scripts now report per-bot Gate contributions and accept independent seed ranges.

## Stress results

All comparisons use 16 Turn, four player Shattered Reach games without economic bonuses or hidden rival information. The first seat rotates through all 11 factions against three Medium bots. Wins may be shared on a tie.

| 27 fixed seeds | Before | 0.34.5 development pass |
| --- | ---: | ---: |
| Emperor average LP | 15.56 | 16.37 |
| Emperor wins | 6 | 8 |
| Games with a successful Gate | 24/27 | 24/27 |

On a separate 27 seed holdout, Emperor averaged **18.44 LP**, **3.19 Tributes**, and **6 wins**; the Gate succeeded in **25/27** games. In a distinct 22 game mixed difficulty holdout, Emperor averaged **17.05 LP** with **7 wins** and **3.14 Tributes**. Wayfarers averaged **15 LP** and **2.63 Tributes** in that mixed sample, up from **13.38 LP** and **2.38 Tributes** immediately before their contact seeking adjustment on identical seeds. A 16 game, six player all Emperor run reached the Gate in **16/16** games and averaged **18.24 LP** per civilization.

These are bot versus bot simulations. The same seed Gate success was flat in the 27 game comparison, some factions remain materially weaker, and no controlled matches against strong human players have been measured. A human skill claim or a 22–25 LP Emperor average would be premature.

## Verification

- Fourteen AI regression tests cover Currency infrastructure, exploration scoring, diplomacy, faction planning, hidden information boundaries, and complete mixed bot campaigns.
- Typecheck and self-hosted build pass. The standalone package excludes live room and commander data; back up the existing `data` directory before replacing an installation.
