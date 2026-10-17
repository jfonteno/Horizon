# Horizon 0.34.7: Aegis Security Export

## Rules and interface

- Aegis's first economic Center costs 1 less Currency. A first Currency Center costs 1 Material, 1 Currency, and 1 Labor. The discount is used once, persists across Turns, and does not apply to Defense Grids.
- At Economy II, Aegis can offer a new Blockade commission from Diplomacy without first constructing a Blockade or advancing Military. The buyer must qualify for direct trade and have a controlled deployment hex. On acceptance, the buyer spends 3 Material, 2 Currency, and 2 Labor plus the Aegis player's fee in Material, Currency, or Research. The fee goes to Aegis; the new Blockade appears at the buyer's chosen hex. An unaffordable offer or illegal destination is rejected without charging either player. Existing ready Blockades remain saleable to agreement partners.
- The commission is available from the Aegis Diplomacy page and linked from Build. Bot buyers can respond to human offers. The Aegis Codex and Academy explain the new path, and the Academy buyer has the resources to try it.
- Aegis bots now prioritize the first Currency Center and Economy II, seek affordable commission buyers, and evaluate incoming commissioned defenses with their complete build cost.

## Matched bot test

Thirty-three four-player Shattered Reach games used the same seeds, 39100 through 39132, with all Emperor bots and 16 Turns per game. Aegis appeared twelve times. The prior 0.34.6 run had approximately 15.6 LP per Aegis seat, one Aegis faction claim, and 28 successful Gates. With this patch Aegis averaged **24.75 LP**, won or tied six games, completed **four Blockade commissions**, made one faction claim, and contributed **3.25 Gate Tributes** per seat. Gates succeeded in **30 of 33 games**, with zero failed Order submissions. Average LP across all bots was **18.79**.

The new opening improves Aegis's economy. The export engine still needs further tuning: only six of twelve Aegis bots reached Economy II, commissions were concentrated in four games, and the two-partner Arms for Peace objective remained uncommon. These simulations are bot-versus-bot evidence, not a prediction of balance against human playtesters.

## Verification and updates

Focused rule tests cover the one-time construction discount, affordability, buyer-funded commission, legal destination, and unchanged existing Blockade sales. The full suite, typecheck, and standalone self-hosted build were run for this release. Existing rooms and commander data require no migration. Preserve your server's `data` directory when updating; the archive excludes live data and backups.
