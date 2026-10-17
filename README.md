# Horizon

Horizon is a deterministic strategy-game prototype built as a modular TypeScript web application. This package includes the Core Set, the Shattered Reach map, and the first playable Shattered Reach expansion factions.

## Salvo targeting update (0.35.1)

A Salvo artillery vessel may fire Bombardment 1 after moving on the same Turn. Select its destination first to preview target hexes from that position, or select a shot first and then choose a compatible destination. Bombardment 2 still requires the vessel to hold position. Any non-rift hex in range can be selected, including empty, friendly, unrevealed, and enemy Habitat hexes. Bombardment resolves after fleet movement and damages hostile Combat Units present then; an empty or otherwise protected hex consumes the shot but grants no bombardment objective progress. The bot now considers firing after moving and favors stationary Habitat garrisons.

## Start locally

Current release: **0.35.4**. See `RELEASE_NOTES_0.35.4.md` for the latest closed-beta playtest patch.

## Version 0.34.8: Faction Engines

Wayfarers receive 2 starting Influence and an Arkship Voyage objective. Aurelians can trade and exchange Influence at Policy II for new LP routes. The starting Salvo Bombard Frigate moves three hexes. Emperor bots have more explicit faction priorities, with a measured 33-game comparison for each player count and remaining Spires and Salvo limits in `RELEASE_NOTES_0.34.8.md`.

## Version 0.34.7: Aegis Security Export

Aegis receives a one-time 1 Currency discount on its first economic Center. At Economy II it can offer a new Blockade directly through Diplomacy: the buyer funds construction and chooses a controlled deployment hex, while Aegis receives an additional negotiated fee. The Academy, Codex, and bots support the new route. See `RELEASE_NOTES_0.34.7.md` for matched simulation results and remaining limits.

## Version 0.34.6: Persistent bot projects

Medium, Hard, and Emperor bots plan prerequisite chains for faction and universal Legacy objectives, forecast the resources and Labor for each chain, seek the missing inputs through production or trade, and remember projects across Turns. The plan is recalculated as milestones complete and Gate needs change. See `RELEASE_NOTES_0.34.6.md` for comparison results and limits.

## Version 0.34.5: Bot economic and exploration planning

Bots route explorers through known sectors to new frontiers, seek diplomatic contacts, and invest in recurring Currency before exhausting scarce reserves. Wayfarers seek Material more deliberately. See `RELEASE_NOTES_0.34.5.md` for stress results and remaining limits.

## Version 0.34.3: Foundry Currency route

Foundry bots seek a Currency specialist early, offer Material for scarce Currency, and scout for contact when no specialist is available. See `RELEASE_NOTES_0.34.3.md` for the observed limits.

## Version 0.34.2: Gate planning and objective feedback

Bots forecast actual production, reserve for upcoming Gate costs, pursue missing production routes and trades, and score actions against measurable Legacy progress. See `RELEASE_NOTES_0.34.2.md` for the 27-seed comparison and remaining LP gap.

## Version 0.34.1: Adaptive faction priorities

Bots now rank faction goals each Turn, forecast early trade partners from public faction specialties, and adjust garrisons when visible threats approach. Aurelians have a planned Influence and Currency opening; Spires focus on concentrated Centers and Resource technology. See `RELEASE_NOTES_0.34.1.md`.

## Version 0.34.0: AI Challenge Levels

The host chooses Easy, Medium, Hard, or Emperor independently for each bot seat in the room lobby. Bots now combine faction doctrine, objective pursuit, public scoring threat ranges, and resource-partner strategy. See `RELEASE_NOTES_0.34.0.md`.

## Version 0.33.18: Windows Build Fix

The Windows self-hosted launcher can build from extracted paths containing spaces or parentheses, including a Downloads folder ending in `(1)`. See `RELEASE_NOTES_0.33.18.md`.

## Version 0.33.17: My Games Management

Completed campaigns are listed separately below active games. Signed-in commanders can download game data or delete a single game or a bulk selection. A host's deletion permanently removes a room for everyone; a participant's deletion removes it only from their own list. Download important game data before deletion.

## Version 0.33.16: Room Persistence and Faction Bots

See `RELEASE_NOTES_0.33.16.md` for save and audit fixes, Explorer persistence, and faction AI logistics.

## Version 0.33.15: Playtest Usability and Helix Reallocation

See `RELEASE_NOTES_0.33.15.md` for room names, seat layout, quick Order review, expanded Codex, and hex fleet CU details.

## Version 0.33.14: Playtest Clarity and Audio

This patch adds Tactical Focus as the active-match soundtrack and Single Click for interface controls. It also improves mobile map access, lobby seat spacing, faction strategy guides, resource iconography and production forecasts, Orders review, bot defaults, and Meridian Brokerage consent. See the release notes for details.

- Tactical Focus plays during active matches and Single Click confirms basic interface actions, with persistent mute and volume controls.
- Resource icons and colors are consistent across status displays. Economy now itemizes deterministic next-production sources.
- Faction guides cover strategic identity, opening priorities, middle and late game, and common pitfalls.
- Lobby seats use a bounded layout and a larger central logo across screen sizes.
- Orders review lists ready vessels without Orders, Salvo movement is available contextually, and Meridian's Brokerage bonus is limited to the first completed deal per Turn.
- Academy Currency access, mobile map fitting, and baseline bot selection are improved.

## Version 0.33.13: Unified Habitat Construction

- Selecting one of your controlled Habitats now opens the same complete Build interface as the Build tab.
- The shortened contextual construction list has been removed, eliminating the separate inventory that omitted faction-specific options.
- Standard construction, faction units, faction upgrades, Factory operations, and Blockade operations remain together in one authoritative menu.

## Version 0.33.12: Wayfarer Mobile Extraction

- Every deployed Arkship, Grand Ark, and Worldship automatically produces 1 matching resource from the Material, Currency, Research, or Influence world it occupies.
- Mobile extraction is independent of Resource IV, so it remains exactly 1 resource while eligible mobile Centers continue to double normally.
- Multiple mobile Habitats may each extract, including when they share a world, and each productive location advances Wayfarer production-location Legacy tracking.
- Hex production details now show extraction beside mobile Center production.
- Bot forecasting values both mobile extraction and mobile Centers when planning Wayfarer movement and reserves.

## Version 0.33.11: Closed Beta Continuity

- My Games replaces individual room shortcuts and divides linked campaigns into Active Games and Previous Games.
- Commander accounts may keep and resume multiple simultaneous games across devices.
- Hosts may give rooms an optional name while the room code remains the invitation and recovery credential. Unnamed rooms use their code as their name.
- Multiple Habitat establishments now account for every reserved Module and may use Habitat Modules constructed during the same Turn.
- Aegis Blockade sale prices now pass the command boundary as validated resource bundles without the former negative-integer error.

## Version 0.33.10: Aegis Blockade Logistics

- Blockade Platforms and the Blockade Deployment Vessel now unlock at Military II.
- Every crewed military vessel can carry one Blockade; the Aegis specialist vessel carries three.
- Select a military vessel on the map to load or deploy Blockade cargo with normal Orders timing.
- Loaded Blockades remain inactive, move with their carrier, and are destroyed if that vessel is destroyed.
- Aegis Security Export unlocks at Economy II. On acceptance, the buyer selects a controlled hex where the purchased Blockade deploys immediately.
- Build, Diplomacy, and Horizon Academy guidance now explain the complete Blockade workflow.

## Version 0.33.9: Automatic Lobby Launch

- Room hosts may opt into automatic launch during room creation or from the faction lobby.
- The authoritative server starts the game when every human seat is claimed, has a faction, and is ready, even when the host has closed Horizon.
- Random bot factions are assigned as part of the same launch transaction.
- Configured Turn timers begin immediately when automatic launch occurs, with a visible warning in the lobby.
- Readiness and the automatic-launch preference persist with the room across reconnects and server restarts.

## Version 0.33.8: Radial Lobby Collision Correction

- Top and bottom seats now extend their labels and controls away from the central room hub.
- The host controller box no longer covers the Horizon logo at the top of the radial layout.
- The bottom seat name no longer overlaps the room code or commander count.
- Four, five, and six-seat rooms retain the responsive radial geometry on desktop and mobile.

## Version 0.33.7: Shattered Reach Access Audit

- Every expansion faction now receives a prominent faction-specific section at the top of the Build menu.
- Locked faction vessels and upgrades remain visible with their exact Technology requirement instead of disappearing.
- Aegis Blockade Tenders open Blockade deployment directly, while owned Blockades expose sale controls in Build and Diplomacy.
- Wayfarer mobile construction can target any owned deployed mobile Habitat, regardless of the permanent Habitat currently selected.
- Guild Factory output controls now appear in Build alongside Enhanced Centers and Factory construction.

## Version 0.33.6: Era Transition Recovery

- Mandatory post-combat cleanup now takes priority over the new-Era Hidden Legacy overlay.
- Post-combat CU redistribution is accepted before Hidden Legacy selection, preventing a circular command lock.
- The interface automatically opens Fleet Command when surviving CUs must be redistributed.
- Hidden Legacy choices are prepared automatically at every Era transition and repaired when older rooms are loaded.

## Version 0.33.4: Complete Lobby Viewport Correction

- The faction lobby explicitly overrides the generic vertically centered dialog layout, preventing tall lobbies from beginning above the viewport.
- The complete six-seat visual now fits within a single desktop or mobile viewport and scales down on shorter screens.
- The lobby remains top-anchored and all settings below the seat visual remain independently reachable by scrolling.

## Version 0.33.3: Lobby Viewport Correction

- New and returning lobbies always open at the room header instead of retaining an earlier scroll position.
- The fixed lobby overlay owns one predictable viewport-height scroll surface on desktop, installed-app, and mobile layouts.
- Radial seats use safe stage insets so top, bottom, and side seats remain completely visible.
- Mobile keeps the faction emblem, labels, and Human or Bot controls inside the stage boundary.

## Version 0.33.2: Playtest Control

- Six-seat rooms use a radial faction-selection display with seat-level human, bot, assigned-faction, and Random controls.
- Players enter the existing faction dossier by selecting their own seat, then confirm the faction from its summary.
- Operations can switch between verified Commander accounts and temporary Room Code access without restarting the server.
- New-room creation, spectators, and a network notice can be adjusted during a playtest window.
- The expanded Operations console manages live games, Commander support, access policy, moderation counts, and service health.

## Version 0.33.1: Verified Commander Profiles

- Passwordless email verification creates or resumes a persistent Commander without storing a password.
- Existing recovery-only profiles can link email, Google, Steam, or Apple without losing rooms or progress.
- Commander Profile is now a dedicated page with career statistics, faction-emblem progress, recent matches, linked identities, active devices, content access, recovery, export, and deletion controls.
- Email verification supports Resend delivery and an explicit server-console test mode.
- Native Windows hosting generates and preserves its authentication secret automatically and enables Steam sign-in by default.
- Health checks and server startup report exactly which identity providers are configured.

## Version 0.33.0: Closed Beta Multiplayer Foundation

- Network creation and joining now require a persistent Commander account.
- Room configuration is consolidated into one page, followed by a visual faction-selection lobby.
- Hosts can switch seats between human and bot control and assign a bot faction or leave it Random.
- Completed eligible multiplayer games settle once into cross-device Commander statistics.
- Faction emblems unlock after three eligible wins and can be selected from Commander Profile.
- Invitation authentication returns players to the room they were trying to join.

## Version 0.32.4: Academy and Arcology Polish

Wayfarer mobile Habitats now use larger vessel icons and expose Migration plus mobile-only construction directly from the map. Farbound Exploration vessels can privately survey and move in the same Turn, with private survey art visible only to its owner. Salvo artillery offers explicit Bombardment strength choices and prevents Bombardment 2 from moving. Aegis Blockades show unique owner-colored icons, respect Open Borders, and never award Glory. Faction cards, Diplomacy status, the collapsible resource tab, Academy foundation launch, and expansion preview pages have also been clarified.

## Version 0.32.1: Shattered Reach Usability

Salvo artillery now exposes a map-first Bombard action with highlighted legal target hexes and deterministic automatic damage allocation. Aegis players can sell Blockades through accepted Diplomacy proposals or gift them through Orders. Every Horizon Academy exercise now gives an exact click path, prepares the pieces needed for its lesson, and lets players restore temporarily hidden guidance without restarting.

## Version 0.32.0: Closed Beta Systems

Commander-linked rooms now form a complete Game Library, completed matches expose detailed Gate and Legacy review, hosts can create clean rematch lobbies, and every human participant can submit structured private feedback. Playtest exports include lifecycle, moderation, objective, Gate, and feedback metrics. Notification categories, color-accessible markers, richer Operations room metrics, and schema-safe self-hosted persistence support sustained closed-beta play.

## Version 0.30.1: Colony Ship Fleets

Civilizations can build additional Colony Ships at any controlled Habitat for 2 Material, 2 Currency, and 1 Labor. Each ship becomes ready next Turn, moves independently, and uses one Habitat Module when establishing an Outpost. Ordinary military forces cannot destroy or capture Colony Ships, but completed Habitats remain vulnerable to military occupation. Future Corsair boarding is a planned faction-only exception, not a current Core Set ability.

## Version 0.30.0: Connected Command

Network rooms now include persistent All Chat, private direct messages, private group channels, a system feed, unread indicators, proposal and hex references, blocking, muting, reporting, and a host review queue. Public Gate pledges make cooperative planning explicit without turning commitments into automatic Orders.

Players can counter incoming trades and inspect the resulting negotiation chain. Trade terms are normalized before evaluation so an offer cannot request and return the same resource, while AI negotiators search for legal, meaningful improvements and abandon exhausted counter chains. The Command Board also uses a smaller hex summary, map overlays for region and seed details, aligned room controls, a dedicated Academy icon, and a simplified map toolbar.

## Version 0.29.1: Map and Launch Reliability

Hex and unit taps now preserve their button targets while intentional drags and pinch gestures control the map. Quick Start navigates directly into its newly created room, shows launch progress, and prevents duplicate creation. Downloadable launchers reuse a production build and durable storage. AI purchase budgeting avoids copying unrelated game history for every candidate plan.

## Version 0.29.0: Strategic AI

Version 0.29.0 makes the Core Set bots plan around reachable Legacy paths instead of treating individual Orders as isolated utility scores. They track Hidden, Universal, Civilization, and Gate goals, estimate public victory threats and Gate risk, adapt diplomatic stances, price trades against both civilizations, counter unfavorable offers, and choose more efficient military task forces. Self-play reporting now records objective completion, faction balance, Gate consistency, counteroffers, and invalid-plan fallbacks.

Measured results and remaining performance targets are documented in [AI validation](docs/AI_VALIDATION_0.29.0.md). Hidden-objective consistency and Standard Board Gate survival still need calibration before the bots can be considered consistently excellent.

## Version 0.28.0: Reliable Multiplayer

Version 0.28.0 makes long-running rooms easier to leave and safely return to. Each private session receives an authoritative checklist of decisions requiring that player, the room exposes a precise public phase, installed clients can show opt-in background reminders, hosts can transfer authority to another claimed human seat, and reconnecting or returning to a room tab forces an immediate synchronization. Timer reconciliation also recovers ready-to-resolve rooms.

The planned 0.27.2 corrections are included in this release. Mobile lobbies have one reachable scroll surface, the Network map supports drag and pinch gestures, First Horizon begins with Hidden Legacy and progresses through authoritative interactions, and Quick Start randomizes player count, map, factions, and seed.

## Version 0.27.1: Command Interface Reliability

First Horizon now creates its three-seat local room without passing through network player-count restrictions, while all configurable room launches normalize the visible seat count into a complete faction roster. Menu controls remain interactive across application updates, lifecycle notices no longer cover the lower-right interface, the Commander Profile and soundtrack controls have explicit interactive surfaces, and the installed application prefers fullscreen presentation without a persistent window-controls overlay. A new Horizon briefing panel replaces duplicated First Horizon promotions with Game News, New Features, Upcoming, and Featured items.

## Version 0.27.0: Unified Command Interface

Every launch path now creates an authoritative room and opens the same map-first Command Board. Local pass-and-play, Quick Start, First Horizon, simulations, and online rooms share one responsive interface. Public civilization dossiers, nonblocking First Horizon guidance, faction classes, menu-wide music, consolidated activity notices, 1-minute to 48-hour timers, server-synchronized private drafts, structured previous-Turn replay, and a purpose-built board background complete the release.

## Version 0.26.0: Commander Identity and Operations

Commander accounts now support multiple managed device sessions, recovery-key rotation, Apple and Google OpenID Connect, Steam OpenID, linked identity controls, synchronized preferences, and versioned solo cloud saves with non-destructive conflict copies. Horizon Operations adds role-gated aggregate metrics, account search, suspensions, session revocation, forced renames, support notes, provider detachment, save repair, health status, and audited administrative actions. No migration from pre-0.26 account records is attempted.

### Install the app

Open a production HTTPS deployment in a supported browser and choose **Install Horizon** from the in-app prompt or the browser menu. The installed application opens in a dedicated window and includes Create, Join, and Continue shortcuts. Network rooms still require a connection to the authoritative Horizon server.

### Windows

1. Install Node.js 22 or newer from https://nodejs.org.
2. Double-click `START_HORIZON.bat`.
3. On the first launch, leave the command window open while it installs the required components and builds the release. Unchanged builds are reused on later launches.
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

## Version 0.23.0: Production Foundation

Version 0.23.0 adds optional commander profiles with private recovery keys. A profile can recover its linked player seat on another device, including host authority, without exposing room credentials in URLs. Recovery rotates the room token so an older device cannot silently retain control.

The Windows and Linux self-hosted server now persists both rooms and account profiles with atomic writes. Cloud deployments persist the same records in D1. Multiplayer clients use authenticated long polling for low-latency room updates and fall back to ordinary synchronization after a network interruption. Rate limits, structured diagnostics, health metadata, privacy and terms pages, data export, profile deletion, migration coverage, and profile-aware backups complete the first production operations layer.

Apple, Google, and Steam sign-in arrived in 0.26.0. Native store wrappers, purchase systems, push notifications, and multi-region service operation remain future release work.

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
npm run validate:app
```

## Content Packs

Version 0.17.0 loads validated external maps, factions, and visual assets from `data/content` without rebuilding Horizon. See [docs/CONTENT_PACKS.md](docs/CONTENT_PACKS.md) and the included `content-packs/frontier-example` reference.

## Version 0.20.4: Faction Ability Integrity

Version 0.20.4 verifies every core faction ability from the player interface through authoritative resolution. Farbound Forward Scan now uses the correct availability flag, requires a ready vessel, rejects already-known targets, and exposes private hex information only to the Farbound player. Network players may plan actions, negotiate, and seal Orders directly during Negotiation without a separate phase transition. Existing room saves remain compatible.

## Version 0.20.3: Map Control and Geography

Version 0.20.3 makes every owned exploration, colony, civilian, and military vessel directly controllable from the network map. Draftable map actions remain available during Negotiation, each constructed exploration hull receives its own selectable marker, and Survey actions appear in the vessel context menu. The Standard Board returns to a regular side-length-5, 61-sector hexagon. Shattered Reach keeps 61 playable sectors while replacing scattered holes with deep void gulfs and narrow routes. Existing rooms retain the geometry they began with.

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
