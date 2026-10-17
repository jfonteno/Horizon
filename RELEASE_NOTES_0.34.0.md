# Horizon 0.34.0: AI challenge update

Hosts can set Easy, Medium, Hard, or Emperor independently for each bot seat in Faction Selection. The level can also be changed while a running room is paused. Existing rooms with older bot profile IDs continue to work; hosts can switch those seats to a new level. Quick Start now uses Medium, and Solo Simulation uses Emperor.

The four levels share legal faction actions, construction, exploration, Gate contributions, and diplomacy. Medium considers attainable Hidden, Universal, and Civilization objectives. Hard and Emperor forecast resource gaps and evaluate trading partners by productive complement, not just current reserves. Their opponent model uses public LP and an interval for possible withheld Hidden LP. It does not inspect a rival's private objective or sealed Orders. Emperor tracks a wider set of scoring goals and weighs late trade dependency and helping likely rivals more heavily.

Faction work includes mobile Currency routing and construction priorities for Wayfarers, independent production priorities for factions with resource bottlenecks, and artillery positioning for Salvo. The bot decision report includes scoring ranges, resource fit, and dependence estimates. A reproducible benchmark is provided at `scripts/benchmark-ai-0.34.0.ts` and `scripts/compare-ai-0.34.0.ts`.

## Testing and limits

The build and full automated suite passed. A mixed-level campaign completes with legal Orders, and a privacy regression changes rival Hidden choices without changing an Emperor opponent model. The 44-game all-faction benchmark had no failed Order submissions. These simulations do **not** establish that Emperor beats an average human player. Difficulty affects search depth and strategy, but mixed AI matches do not yet show a reliable monotonic win ranking. Aurelians, Wayfarers, and Salvo remain weaker than the strongest scoring factions in the benchmark. Further human playtest data and matchup calibration are needed for competitive balance.

## Install

Back up the existing `data/` directory. Extract the patch to a new folder. Preserve the existing `data/` directory and any `horizon-auth.env` settings when replacing application files. Run `Start-Horizon-Windows.cmd` from the new folder. Rooms and Commander accounts require no data migration.
