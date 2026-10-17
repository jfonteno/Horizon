# Horizon 0.34.1: adaptive faction priorities

Bots now rebuild a ranked priority list every Turn from their faction identity, current objective progress, production gaps, diplomatic agreements, and visible military positions. The decision report shows the five highest priorities and any anticipated garrison needs. This uses public faction tendencies as forecasts, without reading rival Hidden objectives or sealed Orders.

The Aurelians favor agreements, Policy technology, and Influence income. Their opening now invests converted Political Capital in an Influence Center and banks for an independent Currency Center before optional spending. Spires favor concentrated economic Centers, upgrades, and Resource technology. The remaining factions have explicit opening priorities, including mobile Centers for Wayfarers and scouting for Farbound.

Hard and Emperor bots anticipate a nearby militarist from public faction identity and known bases. A modest, affordable garrison can be prepared from Turn 3; fresh purchases stop once enough CUs are stationed. Visible rival fleets create a stronger, immediate defense priority. Advanced bots also use a partner's likely production specialty when evaluating early trade agreements, then reassess actual output, scoring threats, and resource dependence as the game develops.

The Aurelian investment forecast allows income from a newly built Center to count toward the next Gate deadline. The bot will still pursue a Tribute as that deadline approaches. All purchases and diplomatic actions remain subject to the normal game rules and budget checks.

This update changes bot decisions, not the underlying LP or resource rules. See `docs/AI_COMPARISON_0.34.1_priorities_27.json` for the repeatable 27-seed comparison against the previous build.
