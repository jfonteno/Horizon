# Horizon 0.33.17

## My Games

- Completed games now appear in a collapsed **Completed games** section beneath **Active games**. A finalized game is classified as completed even if an older saved room still has a stale status.
- Each linked room has **Download Data** and **Delete** actions. Select multiple rooms, or select all, to use the bulk actions.
- Download produces a JSON file. Hosts receive the detailed playtest report, including the turn history, commands, outcome, and diagnostics. Participants receive a scoped game summary and their own faction objectives. Account credentials, room tokens, other players' private objectives, feedback, and messages are excluded from participant downloads.
- Deletion asks for confirmation. A host permanently deletes the room for all players. A participant removes it from their own My Games list while the room remains available to others. Completed match statistics and earned emblems stay on Commander profiles.
- The account's removed-room list persists across devices. Existing room and account save files are normalized automatically. No data migration is needed.

## Updating an existing server

Back up the server's `data/` directory before installing. Keep the existing `data/` directory and account configuration when replacing application files. Do not run an empty server data directory for an existing playtest population. Deletion is irreversible for hosted rooms, so download their data first if it may be useful for research.

## Verification

- TypeScript check and production build passed.
- My Games authorization, completed classification, participant download privacy, participant removal, host deletion, bulk prevalidation, and disk deletion tests passed.
