# Horizon 0.26.0: Commander Identity and Operations

Horizon 0.26.0 establishes a durable player identity and support layer across the installable web application. Because the only pre-release account is controlled by the operator, this release starts cleanly on account schema 2 and does not migrate account records from 0.23.0 through 0.25.0. Game and room save migrations remain unchanged.

## Commander Identity

- Sign in through Google OpenID Connect, Sign in with Apple, or Steam OpenID when the server operator configures them.
- Link and unlink multiple platform identities without storing raw provider identifiers.
- Manage 30-day device sessions, revoke individual devices, sign out other devices, and end the current session server-side.
- Create or rotate a private recovery key. Recovery revokes every existing device session before issuing a new one.
- Continue using a recovery-only Commander when external providers are unavailable.
- Export account data or delete and anonymize the Commander from Settings.

## Cloud continuity

- Synchronize accessibility, interface, music, and volume preferences between signed-in devices.
- Upload and restore versioned First Horizon and solo saves.
- Preserve stale concurrent uploads as labeled conflict copies instead of overwriting the current save.
- Include cloud-save payloads in the player's data export while exposing only bounded save metadata to Operations.

## Horizon Operations

- Open `/admin` with an authorized Commander account.
- View service health, total accounts, recent activity, suspensions, cloud-save counts, and provider adoption.
- Search accounts and inspect bounded identity, session, room, save, support-note, and audit metadata.
- Suspend or restore an account, revoke sessions, require a rename, add a support note, detach a provider, delete a save, or promote a conflict copy.
- Delete an account only with the Operations Owner role.
- Require a reason for every mutation and preserve it in the account audit trail.
- Restrict analysts to aggregate metrics, support staff to read-only account records, and administrators to mutations.

Operations never exposes session or recovery hashes, raw provider subjects, private Orders, Hidden Objectives, surveys, proposals, or hidden map information.

## Deployment

Self-hosted account records use atomic schema-2 JSON files. Cloudflare deployments use the new `horizon_accounts_v2` D1 table from `drizzle/0003_commander_identity.sql`. Configure providers and the initial Operations Owner by following `docs/COMMANDER_IDENTITY.md`.

## Still deferred

Native store wrappers and binaries, purchases and entitlements, friends and groups, notifications, player reports and appeals, chat, ranked matchmaking, achievements, expanded statistics, replays, and new faction expansions are not part of 0.26.0.
