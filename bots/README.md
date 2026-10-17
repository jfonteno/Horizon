# Horizon bot profiles

Bot personalities live in `bots/profiles` and are discovered when Horizon starts.
Adding another valid JSON profile does not require editing the game engine. Restart
Horizon after adding a profile so the local build can discover it.

Profiles control priorities, search breadth, risk tolerance, resource reserves,
Technology preferences, and strategic behaviors. They cannot read concealed game
state or change rules. Entirely new algorithms still belong in `game/ai`.

Every profile must match `bots/schemas/bot-profile.schema.json`, use a unique ID,
and declare `profileVersion: 1`.

## 0.34.0 selectable challenge levels

Every network bot seat has an independent Easy, Medium, Hard, or Emperor profile. The host may change a bot's level in the lobby or while the room is paused. Existing saved bot profile IDs remain valid. Easy handles basic expansion, faction abilities, and the Gate. Medium pursues attainable scoring objectives. Hard models rivals' possible Hidden LP and complementary trade partners. Emperor tracks more simultaneous objectives and weights late-game dependency and rival scoring threats more strongly.

Benchmark a mix of tiers across all eleven factions with `node --import tsx scripts/benchmark-ai-0.34.0.ts 44`. This is a deterministic AI versus AI comparison, not a measure against human playtesters.

## 0.29.0 strategy and diagnostics

The shared planner combines Hidden, Universal, Civilization, and Gate goals with
public opponent threat models. Expert profiles use this model for diplomacy,
counteroffers, faction economy, construction, Technology, and military tasks.
Bot-to-bot negotiations resolve immediately when legal; sealed Orders retain
their committed resources.

Run reproducible self-play with optional profile, map, and seat count arguments:

```bash
npm run simulate:ai -- 3 meta-analyst shattered-reach 6
npm run simulate:ai -- 1 strategic-director standard-board 4
npm run simulate:ai -- 1 strategic-director standard-board 5
```

Each run uses seeds beginning at 21000 and rotates faction seats between games.
Reports measure every decision, including rejected planned submissions that
recover by sealing a Hold. The release's measured performance and limitations
are documented in `docs/AI_VALIDATION_0.29.0.md`.
