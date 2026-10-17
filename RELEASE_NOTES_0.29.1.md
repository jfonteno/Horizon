# Horizon 0.29.1 — Map Input and Launch Reliability

This patch restores hex and unit selection in the unified Command Board and reduces unnecessary work during Quick Start and AI planning.

## Map input

- A tap keeps its original hex/unit button target. Pointer capture now begins only after an intentional drag or a second touch starts a pinch.
- Slow drags use accumulated movement, so small successive movements pan the map correctly.
- Pinch zoom preserves the final focal point even when the final animation frame runs after finger release.
- Touch capture transfers, cancellations, keyboard activation, and the first tap after a drag are handled explicitly.

The selection bug came from the earlier touch gesture implementation: it captured every pointer press on the viewport before buttons could receive their normal click. Earlier source-level gesture checks did not exercise that event sequence.

## Launch and performance

- Local launches use client navigation and a short-lived, one-use in-memory handoff of the creation response, avoiding an application reload and redundant room resume/content fetch.
- Launch buttons show progress and are guarded against repeated room creation.
- Quick Start describes the actual randomized 4–6 player setup.
- Windows/macOS/Linux launchers build the standalone production server once, reuse unchanged builds, and invalidate the cache when source, dependencies, Node runtime, or server artifact changes. The first launch still installs dependencies and builds the release.
- Standalone play uses the existing durable room/account repositories under `data/`.
- The AI planner's budget projection copies only modified Habitat data instead of cloning the entire game history and all AI reports for every candidate. Purchase ordering, shared budgets, and capacity checks remain intact.
- Room command callbacks remain stable during synchronization, avoiding unnecessary draft autosave timer resets.

## Validation

New regression tests cover mouse/touch/pen taps, cumulative drag thresholds, click suppression, keyboard activation, pinch bounds/anchoring, pointer cancellation, capture transfer, gesture disposal, private one-use room handoff, build-cache invalidation/failure, and non-mutating sequential purchase budgets.

Full rule/server tests, typecheck, lint, hosted and standalone builds, content validation, application readiness, and artifact verification are run for this release. Native touchscreen/browser visual verification could not be completed in this environment because the browser surface cannot reach the local server. The tests exercise the input controller and authoritative room behavior, rather than claiming device-level verification.

The final full suite passed all 196 tests. Production API checks covered 4, 5, and 6 players on both public maps and a complete First Horizon turn: Hidden selection, map inspection, draft saving, Exploration Vessel movement, bot actions, and automatic resolution. Local production room creation measured 7–20 ms; the tutorial turn resolved in 63 ms. These server timings do not measure total loading time on a phone.

Remaining performance work includes removing the unused legacy local-board code still bundled with the main menu. This patch improves the active launch path without attempting that larger cleanup.

The broader AI calibration targets documented in `docs/AI_VALIDATION_0.29.0.md` remain open, including Hidden-objective consistency and five-player Standard Board Gate survival.
