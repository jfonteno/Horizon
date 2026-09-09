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
  CONTENT_PACKS.md           Drop-in map and faction authoring guide
  SELF_HOSTING.md            Physical server and Cloudflare Tunnel guide
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
npm run typecheck
npm test
```

## Content Packs

Version 0.17.0 loads validated external maps, factions, and visual assets from `data/content` without rebuilding Horizon. See [docs/CONTENT_PACKS.md](docs/CONTENT_PACKS.md) and the included `content-packs/frontier-example` reference.

## Version 0.20.2: Illustrated Faction Archive

Version 0.20.2 replaces scoreboard initials with the six faction emblems and turns lobby faction selection into a full-screen civilization archive. Players can browse every available faction, read its lore, compare strategic roles, inspect Homeworld production, study detailed abilities and unlock requirements, and review Civilization Legacy objectives before making a server-authoritative selection.

## Version 0.20.1: Larger Standard Board and Vessel Selection

Version 0.20.1 expands the Standard Board into a regular side-length-6 hex with 91 playable hexes. Exploration and Colony Ship clicks now always open their contextual action cards, including during Negotiation, so the interface no longer appears unresponsive before Orders begin. Existing 61-hex rooms retain their original board geometry when loaded.

## Version 0.20.0: Consolidated Playtest Rules

Version 0.20.0 implements the consolidated playtest rulebook except Hazards. It adds selectable four-Era and five-Era formats, the hazard-free 61-hex Standard Board, explicit Negotiation and Orders phases, constructible Exploration hulls with path movement and public scanning, directional Defensive Pact and Envoy permissions, post-combat CU redistribution, flexible faction Homeworld production, dynamic Gate requirements, and the expanded Universal, Hidden, and Civilization Legacy catalogs. Existing saved games and rooms migrate to the four-Era format.

## Version 0.19.2: Contextual Map Commands

Version 0.19.2 makes the tactical map the primary command surface. Selecting a vessel opens only the actions that vessel can perform, selecting a controlled Habitat presents affordable construction choices, and stacked units can be selected individually. Farbound Survey, Habitat establishment, CU transfers, task-force movement, and construction remain connected to the authoritative game rules.

A compact faction scoreboard now shows contact, LP, Order status, agreements, and incoming proposals. Activity entries can return the player to a referenced hex, drafted Orders are numbered on units and destinations, and the pre-seal checklist identifies unresolved objectives, budget errors, available Habitat construction, Gate participation, and unanswered diplomacy.

## Version 0.19.1: Map-First Network Interface

Version 0.19.1 replaces the permanently expanded Network sidebars with a compact collapsible command dock. Diplomacy, Legacy, Economy, and Technology open in large dedicated workspaces over the map. Standings and Turn status are available from the header, and incoming proposals produce prominent clickable alerts.

Bot civilizations now immediately evaluate incoming human trades, agreements, and Technology offers using their strategic priorities and available resources. Human players are required to draw and select a Hidden Legacy objective before taking any other action at the beginning of each Era.

## Version 0.19.0: Complete Network Operations

Version 0.19.0 brings the online interface to gameplay parity with the local interface. Network players can now contribute to the Horizon Gate, use the System Market, inspect and claim every Legacy objective category, establish Habitats with clear eligibility guidance, and use Foundry, Farbound, and Meridian faction operations.

The Network map now presents every available action after a vessel is selected, provides zoom and centering controls, confirms drafted actions, and saves unsealed private Orders in the player's browser for the current room and Turn. Mobile navigation remains reachable in a persistent bottom action bar. The local Military panel is also restored.

## Version 0.18.3: Lobby and Turn Timing

Version 0.18.3 gives the online lobby one authoritative scroll surface and places faction selection directly beside the Ready confirmation. Faction buttons now expose clear selected, available, and reserved states across desktop and mobile layouts.

Hosts may disable the Turn timer or choose a duration in room settings. The deadline is stored and enforced by the authoritative server, survives restarts, pauses with the room, and appears as a live countdown to players. When it expires, civilizations without sealed Orders receive Hold and the complete Turn resolves. Timer resolutions are included in room history, audit verification, and playtest reports.

## Version 0.18.2: Native Windows Hosting

Version 0.18.2 repairs production static-file delivery when Horizon runs directly on Windows. The Windows self-hosted server now serves compiled JavaScript, CSS, images, fonts, and map tiles through a Horizon-owned compatibility layer before requests reach Vinext, avoiding the path-separator mismatch that caused a large unstyled logo and an unusable public page.

The included `Start-Horizon-Windows.cmd` launcher installs dependencies when needed, creates durable data directories, builds the standalone server, verifies both the health endpoint and a compiled stylesheet, starts Horizon on loopback, detects the Cloudflare Windows service, and opens `play.horizongame.us`. Linux, Docker, Cloudflare Workers, room saves, and 0.18.1 faction selection behavior are unchanged.

## Version 0.18.1: Lobby Faction Draft

Version 0.18.1 separates network seat claiming from faction selection. Every human player now claims a numbered seat, chooses any faction not already reserved by another seat, and locks that choice by marking Ready. The host can wait for the other players to choose and take an available faction last.

Faction changes rebuild only the pre-game setup. The room retains its map, seed, player controllers, and randomized starting hex assignment, while applying the selected faction's full starting package. Lobby seat resets release the faction; replacements during a paused game inherit the faction already in play. Existing 0.18.0 rooms migrate with their current factions selected.

## Version 0.18.0: Playtest Operations

Version 0.18.0 makes the network Alpha practical for sustained remote testing. The network board now adapts to phones and tablets, the primary validation scripts run in PowerShell, Command Prompt, macOS, Linux, and Termux, and Cloudflare tooling is optional for standalone development. Hosts receive expanded seat administration and can download a complete JSON playtest report containing setup, standings, historical metrics, diagnostics, and a tamper-evident accepted-command ledger.

New 0.18.0 rooms chain every accepted server command to the resulting authoritative state. Proposal identifiers derive from client command identifiers, which removes a source of nondeterminism and makes exported command histories suitable for repeatable investigation. Rooms created before 0.18.0 remain loadable, but their report correctly marks the audit ledger as incomplete.

## Version 0.17.2: Randomized Starting Positions

- Shuffle the selected factions among the map's active starting hexes for every new game.
- Keep explorers, colony ships, starting carriers, home ownership, and faction-specific starting Centers synchronized.
- Reproduce the same starting assignment from the same game seed without changing the seeded tile layout.
- Support the currently active starting hexes for four, five, and six-player games and external maps.

## Version 0.17.1: Farbound Survey and Interface Polish

- Replace the Farbound explorer's short-range Forward Scan with one private Negotiation Survey per Turn.
- Trade that new survey intelligence during the Turn in which it was gathered.
- Preserve the Long-Range Surveyor and its existing Orders-phase Long-Range Survey ability.
- Use a more futuristic condensed interface font stack and a larger board-header logo.

## Version 0.17.0: Content Pack Foundation

- Drop versioned map and faction folders into a self-hosted server and activate them with a restart.
- Select installed maps and factions dynamically during game setup.
- Pin exact pack versions in saves and multiplayer rooms.
- Reuse deterministic core faction mechanics and AI doctrines without arbitrary executable plugins.
- Validate packs, local assets, compatibility, paths, sizes, and IDs before play.
- Back up external content together with persistent rooms.

## Self-host a multiplayer server

Version 0.16.1 introduced the Docker deployment with durable local room storage, health checks, backups, guarded restores, and an optional Cloudflare Tunnel. See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## Version 0.16.1: Self-Hosted Deployment

- Run Horizon on a physical server with Docker Compose and restart-safe room storage.
- Check application and storage readiness through `/api/health`.
- Add an optional outbound-only Cloudflare Tunnel without exposing the game port publicly.
- Back up and restore room data with retention and recovery safeguards.
- Publish verified container images to GitHub Container Registry on main and version tags.

## Version 0.16.0: Multiplayer Beta

- New network games begin in a readiness lobby with player and spectator invitation links.
- Hosts can start, pause, resume, end, archive, and assign disconnected or open seats to the Strategic Director bot.
- Browser-held seat credentials reconnect automatically after refresh or temporary connection loss.
- Every command carries an idempotency key, passes runtime payload validation, and remains protected by atomic room revisions.
- Versioned room payloads migrate earlier network rooms without replacing their game state.
- Public room history records seat, phase, Order, and diplomacy activity while concealing private terms.
- Defensive Pact forces combine with a Habitat owner during defense, while Alliance forces form deterministic combat coalitions.
- Coalition casualties, Varkesh rewards, and Habitat capture ownership use stable deterministic ordering.
- Required Hidden Legacy, capture, and diplomatic decisions display attention badges and blocking guidance.
- Spectators can pause their local view or select fast, live, and slow synchronization speeds.
- Completed network games use the full LP, resources, Habitats, and trade history dashboard.

## Version 0.15.0: Network Operations

- Command task forces from the shared map with private simultaneous movement Orders.
- Group ready carriers in one hex, preview adjacent public combat strength, and target legal destinations.
- Load and station Combat Units through authenticated server commands.
- Pause network play for mandatory captured-Center bookkeeping and resume after the conquering player decides.
- Send direct trades, formal agreements, and Helix Technology Exchange proposals.
- Accept, reject, and cancel proposals from private player views.
- Withdraw from agreements at Turn end or break them immediately under the normal rules and penalties.
- Use Aurelian Political Capital and the existing faction economy commands online.
- Preserve private objectives, surveys, proposals, sealed Orders, and bot analysis in public spectator views.
- Reject conflicting room writes with atomic revision checks.

## Version 0.14.0: Network Playable Alpha

- Added authoritative network rooms, authenticated private seats, public spectator projections, interactive map targeting, server-side Order validation, and automatic bot resolution.

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

For a local production build on Windows, macOS, Linux, or Termux, run `npm run build:self-hosted`. The 0.18.0 task runner sets the standalone environment consistently on every platform.

On Android Termux, keep the repository under the Termux home directory rather than shared storage, then use `npm ci --include=dev` and `npm run dev -- --host 127.0.0.1`. Cloudflare packages are optional in standalone mode, so an unsupported Android `workerd` binary no longer blocks the rest of the installation.
