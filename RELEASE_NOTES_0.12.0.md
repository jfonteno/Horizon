# Horizon: Shattered Reach 0.12.0

## Spectator Lab

- Adds a one-click six-faction spectator simulation from game setup.
- Adds Pause, Resume, Step, and 0.5x, 1x, 2x, and MAX playback controls while preserving the normal sealed-Orders sequence.
- Keeps spectator games read-only while allowing map inspection and public AI analysis.
- Records one authoritative statistical snapshot at setup and after every resolved Turn.
- Adds endgame line graphs for every faction's Legacy Points, resource reserves, controlled Habitats, and completed trades.
- Adds a faction performance ledger with final and peak resources, final and peak Habitats, trades, Tributes, Technology, and military strength.

## Meta Analyst 2

- Adds persistent public opponent models for LP trajectory, military strength, expansion, aggression, trade reliability, and Gate reliability.
- Adds multi-Turn diplomatic commitments and resource routing for Gate support and trade networks.
- Uses legal Shared Market exchanges to repair Tribute resource shortfalls.
- Routes Colony Ships toward valuable revealed economic worlds instead of evaluating only immediate neighboring hexes.
- Adds public meta-game warnings for Gate hostage risk, runaway leaders, and shared Currency bottlenecks.
- Expands AI decision reports with opponent assumptions, active commitments, diplomacy actions, and meta-game warnings.

## Compatibility

Existing local saves migrate to schema version 12. Older completed games without historical snapshots remain viewable with a final-state analytics fallback. Migrated seats retain their existing human or bot controller assignment.
