# Horizon 0.27.1: Command Interface Reliability

## Room creation

- Local rooms now validate independently from four-to-six-player network rooms.
- First Horizon can create its intended three-seat teaching room through the unified Room interface.
- Configurable game creation now fills any faction or controller entries missing after switching between tutorial and standard configurations.
- Room creation errors continue to appear inside the creation panel instead of masquerading as an inactive control.

## Menu interaction

- Removed the fixed offline, installation, and update cards from the lower-right corner.
- Application updates now activate silently from menu screens and never force a reload during a live room.
- JavaScript and stylesheet requests use network-first service-worker behavior to prevent stale bundles from leaving a partially interactive menu.
- Decorative star, nebula, and orbit layers can no longer intercept pointer input.
- Commander Profile, fullscreen, and soundtrack controls use explicit interactive buttons and synchronized settings.

## Presentation

- The installed application now prefers fullscreen mode and no longer requests the persistent Windows controls overlay.
- Fullscreen can be entered or exited directly from the top bar and footer.
- The main menu has one First Horizon entry point.
- The former training promotion is now a selectable Horizon briefing with Game News, New Features, Upcoming, and Featured items.

## Verification

- Added regression coverage for three-seat local tutorials, network player-count enforcement, silent lifecycle behavior, seat normalization, consolidated training links, and fullscreen manifest settings.
