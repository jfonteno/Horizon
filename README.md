# Horizon

Horizon is a deterministic strategy-game prototype built as a modular TypeScript web application. This package currently includes the Shattered Reach map and the six original civilizations.

## Start locally

### Windows

1. Install Node.js 22 or newer from https://nodejs.org.
2. Double-click `START_HORIZON.bat`.
3. On the first launch, leave the command window open while it installs the required components.
4. Keep the command window open while playing. If startup fails, the window now remains open and displays the cause.

### macOS or Linux

Run `START_HORIZON.command`.

## Project structure

```text
app/                         Web interface
  themes/                    CSS visual packages
game/
  ai/                        Profile-driven planning and decision reports
  engine/                    Map generation, geometry, and saves
  factions/                  One definition file per civilization
  maps/                      One definition file per playable map
  rules/                     Shared costs and rule tables
  server/                    Rooms, privacy projection, and persistence adapters
  themes/                    Theme metadata and registry
  types.ts                   Shared game-state contracts
docs/
  ARCHITECTURE.md            Extension guide
public/                      Logos and visual assets
bots/                        Drop-in AI personality profiles and schema
app/api/rooms/               Server room API
```

The registries in `game/factions/index.ts`, `game/maps/index.ts`, and `game/themes/index.ts` are the public libraries used by the game. Interface code does not need to know where an individual package lives.

## Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Before committing:

```bash
npm run lint
npm test
```

## Version 0.13.0: Strategic Mind

- Meta Analyst now creates a four-Turn economic and Gate forecast before choosing Orders.
- Each faction follows a distinct strategic doctrine, including Aurelian Political Capital conversions, Meridian brokerage, Helix Technology Exchange, and Farbound information sales.
- Opponent models classify public behavior as runaway, militarist, expansionist, broker, Gate steward, free rider, or balanced.
- Resource reserves are tied to personal contribution deadlines and projected future Tribute costs rather than a single static reserve number.
- Coalition support routes surplus resources toward the civilization closest to completing a contribution, while Trade Agreements unlock Labor-backed exchanges.
- The victory-impact model pressures leaders, avoids low-value kingmaking attacks, and changes optional spending during a Gate emergency.
- AI analysis now exposes the strategic forecast, doctrine, projected Gate capacity, contribution deadline, resource priorities, and opponent archetypes.
- The self-play command reports Gate completion, contribution balance, LP, reserves, Habitats, trades, Technology, military strength, search depth, and faction results.

Run `npm run simulate:ai -- 100` to evaluate the profile over 100 deterministic six-faction games.

The included 100-game benchmark averaged 16.32 of 18 Gate Tributes with a 50 percent completion rate. See `AI_BENCHMARK_0.13.0.json` for the complete output and faction distribution.

## Version 0.12.0: Spectator Lab

- Run a complete six-faction Meta Analyst simulation directly from setup, with a read-only spectator role, pause, step, and four playback speeds.
- Every resolved Turn records an authoritative analytics snapshot for all civilizations.
- The endgame performance board charts LP, total resource reserves, controlled Habitats, and completed trades across the full game, alongside final and peak faction statistics.
- Meta Analyst now maintains public opponent models, persistent diplomatic commitments, Gate-support resource routes, legal Market conversions, and deliberate pathfinding toward valuable colony worlds.
- Decision reports expose opponent assumptions, commitments, resource-routing actions, and public meta-game warnings without revealing private information.

Run `npm run simulate:ai -- 100` to exercise complete six-faction autonomous games across 100 deterministic seeds and print aggregate results.

## Version 0.11.0: Meta Analyst

- Any local seat can be assigned to a human or the expert Meta Analyst controller before launch, including fully autonomous four-to-six-player games.
- The profile-driven AI engine generates legal movement, construction, fleet, Technology, Gate, and faction-vessel candidates, then uses bounded beam search to choose a resource-valid bundle.
- The Meta Analyst combines exact combat forecasts, two-Turn public threat maps, counterfactual retaliation ceilings, faction capability ledgers, Legacy progress, resource reserves, and Gate pacing.
- Bots choose mandatory Hidden objectives, review incoming negotiations, resolve capture bookkeeping, seal private Orders, and complete the entire 16-Turn game loop automatically.
- Decision reports expose posture, confidence, search size, accepted and rejected actions, and knowledge boundaries while keeping secret Orders and Hidden objectives concealed until the rules reveal them.
- Bot definitions live under `bots/profiles`. A valid new JSON profile is discovered at startup without modifying the core game engine.

Run `npm run simulate:ai -- 100` to exercise complete autonomous games across 100 deterministic seeds and print aggregate results.

## Version 0.10.4: Legacy Command

- Universal, Civilization, and selected Hidden Legacy objectives show live progress bars and objective-specific counts.
- Each civilization must choose a Hidden Objective before ending the first Turn of every Era.
- Valid simultaneous Gate overflow Tributes all expend their resources and receive personal credit while the shared Gate total stops at its cap.
- Once the Gate is complete, no additional Tribute Orders can be drafted or submitted.

## Version 0.10.3: Purchase Command

- Every construction, unit, Technology advancement, and Gate Tribute displays its complete resource and Labor cost.
- Drafted purchases share one projected budget, and unaffordable Orders are blocked both in the interface and when Orders are submitted.
- Technology is fully accessible through a redesigned five-branch progression screen with costs, benefits, and current levels.
- The Orders console now focuses on review, projected resources, removal, and submission rather than duplicating map movement controls.
- Build is map-driven: choose Build, select a highlighted controlled Habitat, then choose an eligible construction option for that location.
- Construction and Technology remain secret Orders and become usable on the following Turn after simultaneous resolution.

## Version 0.10.2: Large Map Turns

- The standard board is larger at its default zoom, with room to pan across a more expansive strategic map.
- Backend adjacency now uses the same reciprocal odd-column geometry as the rendered hex grid.
- Every active civilization can use Market, Diplomacy, and faction negotiation actions during its private turn.
- Submitting Orders ends the active civilization's turn and hands control to the next seat. All Orders still resolve simultaneously after every seat submits.
- Existing 0.10.1 saves migrate directly into the unified Orders turn flow.

## Version 0.10.1: Map-First Command

- Vessel artwork now occupies a dedicated interaction layer above all hex art.
- Click a vessel, choose an available action, then click a highlighted legal target to draft its secret Order.
- Map Orders replace an existing draft for the same vessel, preventing accidental duplicate commands.
- Trade, Market, and Diplomacy views remain accessible throughout the Turn and clearly become read-only outside Negotiation.
- Negotiation now links directly to the combined Trade and Diplomacy console.

## Version 0.10.0: Visual Map Overhaul

The standard board now uses substantially larger hexes inside a zoomable, pannable map viewport. Fit and Center controls keep the full 61-hex Shattered Reach board usable on smaller displays, while Control or Command plus the mouse wheel adjusts zoom.

Every revealed tile type now uses dedicated cinematic world art. Unrevealed hexes use one neutral survey-seal image that provides no clue about the underlying tile. A Farbound private survey may display the surveyed artwork only in that civilization's authorized view.

The vessel library includes distinct scalable silhouettes for every standard military carrier, both Varkesh vessels, all four Exploration tiers, the Colony Ship, Prospector, Envoy, and Long-Range Surveyor. Map fleets show a lead-vessel silhouette, vessel count, and CU total; fleet and construction panels show the individual vessel type.

Tile art, ownership borders, vessel markers, labels, and interaction states are separate rendering layers. Asset paths are centralized in `game/themes/assets.ts` so future visual packages can replace artwork without changing rules.

## Version 0.9.0: Sealed Orders and Era Scoring

Every Turn now follows the locked Production, Negotiation, secret Orders, and Resolution sequence. Each civilization privately drafts and seals its complete Orders, then passes the device. No submitted Order changes the shared state until every civilization has sealed and the full batch is resolved.

Resolution uses one fixed deterministic sequence: scans, movement and edge conflicts, hex combat, Habitat and location actions, construction, Technology, Gate Tributes, and scoring. Opposing forces that cross the same edge fight before completing movement. Valid simultaneous Tributes all pay and receive personal credit even when their combined Orders reach the Gate cap.

Hidden Legacy LP is no longer awarded when an objective first becomes true. Completion remains private throughout the Era, then all qualifying Hidden Legacy cards score and reveal during Era-end resolution.

Version 0.9.0 retains the server-capable room architecture from 0.8.0. Player-specific room views also redact sealed Orders belonging to other civilizations. Remote seats remain read-only while server-validated remote command submission is prepared for a future patch.

Negotiation still supports direct Trade, Diplomacy, Brokerage, survey sales, and permitted faction conversions. Vessel movement, Prospect, scans, Habitat establishment, construction, Technology, and Gate Tribute are issued only through the private Orders console.

The standard Shattered Reach map is hazard-free. Hazard concepts remain reserved for optional future map packages rather than the base playtest.

Local game progress is stored in the browser. Existing saves migrate to schema version 13 automatically. Room resume credentials stay on the device that claimed the room or seat. Prior manually recorded LP is preserved as Manual LP. Use **New game** to clear the local game save.

For a local production build, run `HORIZON_STANDALONE=1 npm run build` on macOS or Linux. On Windows PowerShell, run `$env:HORIZON_STANDALONE=1; npm run build`.
