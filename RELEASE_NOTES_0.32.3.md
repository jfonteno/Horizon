# Horizon 0.32.3: Mobile Turn Flow

Version 0.32.3 keeps the end-of-turn and objective-selection flows usable on compact mobile screens and shortens the routine Orders review.

## Mobile safeguards

- The turn-resolution briefing now owns the full mobile viewport and sits above the fixed command bars.
- Briefing history scrolls independently while `Plan next Turn` remains in a persistent action footer.
- Mandatory Hidden Legacy selection uses a full dynamic viewport with safe-area padding, so every objective remains reachable.

## Orders review

- The Orders panel now leads with the drafted queue, projected cost, and Seal Orders control.
- The pre-seal checklist and Shattered Reach fallback tools remain available as collapsed details below the primary action.
- Long order queues scroll inside a bounded review area instead of pushing the Seal Orders control far down the panel.
- A sealing-in-progress guard blocks repeat taps.
- After submission completes, the Orders panel closes and returns the player to the map.

## Verification

Regression coverage checks the briefing's fixed continuation action, the full-height Hidden Legacy selection surface, the condensed Orders hierarchy, and the automatic return to the map after sealing.
