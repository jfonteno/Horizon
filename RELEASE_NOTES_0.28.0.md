# Horizon 0.28.0: Reliable Multiplayer

Horizon 0.28.0 combines the planned 0.27.2 interaction corrections with the first asynchronous multiplayer reliability release.

## Mobile command corrections

- The pregame lobby now uses one full-height mobile scroll surface and no longer competes with a second Room panel instance.
- The fixed game command dock is removed while the lobby or pause surface is open, keeping every faction and room action reachable.
- The live Network map supports one-finger or pointer dragging, two-finger pinch zoom, Fit, Center, and automatic Homeworld focus.
- Mobile map height uses the dynamic viewport so browser controls and orientation changes do not strand controls off screen.

## First Horizon

- Hidden Legacy is now the first lesson after the introduction, with choices prepared when the scenario is created.
- Hex inspection and interface discovery are authoritative tutorial events, so completed work advances naturally in the unified room UI.
- Tutorial synchronization advances one lesson at a time instead of skipping already-satisfied lessons.
- First-open explanations introduce every major interface without locking other tabs.
- Combat guidance opens Military, and combat and final lessons now require their stated accomplishments.

## Asynchronous reliability

- Every private room session includes an authoritative return checklist for readiness, Hidden Legacy, proposals, Orders, captured Centers, and combat redistribution.
- Installed clients can opt into browser reminders while Horizon is running in the background. Notification clicks return directly to the room.
- Room summaries expose a clear authoritative phase and current host seat.
- Hosts can deliberately transfer authority to another claimed human seat before leaving a long-running match.
- Returning online or bringing the room tab back into view immediately resynchronizes the room.
- Expired timer reconciliation can recover a room already left in the ready-to-resolve phase.

## Quick Start

Quick Start now chooses four to six civilizations, either compatible core map, a random human faction, unique AI factions, and a recorded random seed.

