# Contributing to Horizon

Horizon uses a shared deterministic TypeScript rules engine. Keep rules, content packages, presentation, and server transport separate so local play, hosted rooms, automated tests, and future replay tools use the same state contracts.

## Development check

```bash
npm ci
npm run lint
npm test
```

Add tests for every new rule, save migration, privacy boundary, or room-state transition. Never commit credentials, room tokens, deployment secrets, or generated dependency folders.

## Content packages

- Add factions under `game/factions/` and register them in the faction library.
- Add maps under `game/maps/` and register them in the map library.
- Add visual packages under `game/themes/` and `app/themes/`.
- Add shared behavior under `game/rules/` or `game/engine/`.
- Add network transport and persistence under `game/server/`.

Changes to `GameState` require a migration in `game/engine/save-game.ts` and a schema-version increment.
