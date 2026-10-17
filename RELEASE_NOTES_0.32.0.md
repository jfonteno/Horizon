# Horizon 0.32.0: Closed Beta Systems

Version 0.32.0 turns the verified 0.31.2 rules build into a more complete self-hosted closed-beta product. It does not add factions, maps, payments, or cloud deployment requirements.

## Game lifecycle

- Added a Commander-linked Game Library grouping rooms that need attention, active and paused games, waiting lobbies, and completed matches.
- Expanded the endgame experience with performance graphs, standings, the Gate ledger, revealed Legacy results, and a match timeline.
- Added host-created rematch lobbies. A rematch receives a new room code and seed while preserving the previous completed room and its report.
- Rematches retain the previous map, format, factions, controller assignments, expansion access, and Turn timer. Human seats must rejoin and confirm readiness.

## Closed-beta feedback and reports

- Every human participant may submit or revise a private one-to-five experience rating, difficulty rating, play-again response, issue categories, and note after a match.
- Feedback is stored with the authoritative room and is visible only in the host's complete playtest export.
- Reports now include accepted-command counts, command categories, seat recoveries, host transfers, moderation totals, chat volume, Turn history, objective results, the Gate ledger, and aggregate feedback.
- Feedback notes and moderation reasons remain redacted from the public room event stream and command audit payloads.

## Accessibility and attention

- Added color-accessible marker styling that supplements faction color with borders and shape changes.
- Added synchronized preferences for Turn, message, proposal, and deadline reminders.
- Browser notifications honor the selected reminder categories while the in-game attention list remains available.
- Existing keyboard navigation, visible focus, larger text, high contrast, reduced motion, and screen-reader labels remain supported.

## Operations and persistence

- Horizon Operations now reports active, paused, waiting, and completed rooms, open match-chat reports, and submitted feedback totals.
- Memory, disk, and D1 room repositories now expose the same bounded room inventory interface for operational metrics.
- Room schema 9 adds structured feedback with automatic migration from earlier room records.
- The self-hosted server remains the supported development and closed-beta path. Cloudflare production migration and commerce remain deferred.

## Validation target

This release is intended for complete four-player, five-player, and six-player closed-beta games, reconnect and restart testing, all 11 Horizon Academy courses, communication safety testing, and evidence-based balance review.
