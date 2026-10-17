# Horizon 0.33.3

Horizon 0.33.3 corrects the faction-selection lobby viewport behavior found during desktop and mobile playtesting.

## Lobby visibility

- Opening or returning to a lobby now resets both the lobby scroll container and the underlying document to the top before the first visible frame.
- A second guarded reset runs after browser focus and scroll restoration settle, preventing mobile browsers and installed desktop windows from reopening midway through the lobby.
- The full-screen lobby now uses its fixed viewport bounds as the scroll area instead of combining a viewport height with additional padding.
- Desktop and mobile scrolling retain momentum while preventing the page behind the lobby from taking over the gesture.

## Radial seat safety

- Seat positions are constrained to safe horizontal and vertical insets inside the radial stage.
- The upper and lower seats can no longer be clipped by the stage boundary.
- Mobile receives smaller safe insets and a slightly taller stage so labels, emblems, and Human or Bot controls remain visible.

No game rules, room records, Commander accounts, or saved games are changed by this patch.
