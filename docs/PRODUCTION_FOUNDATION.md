# Horizon production foundation

Version 0.33.13 maintains the self-hosted service boundary needed for closed-beta account testing. It does not claim that the playtest is already ready for public app-store distribution.

## Identity and recovery

Commander profiles are optional. A profile consists of a public commander ID, display name, provider type, timestamps, a hash of a secret recovery key, and a one-way hash for a verified email identity when one is linked. The raw recovery key is returned only when the profile is created and remains in that player's browser until they sign out.

Creating or joining a room while signed in links the profile to one human seat. Recovering that room on another device rotates the seat token. If the linked profile created the room, host authority moves with the recovered seat.

Version 0.33.13 supports passwordless email verification and server-validated Apple, Google, and Steam sign-in when the corresponding host credentials are configured. Email delivery uses Resend in production or an explicit console-code mode for supervised local testing. Provider credentials are never bundled with a release archive.

## Persistence

Native Windows, Linux, and Docker deployments use atomic JSON files:

- `data/rooms` contains authoritative room state.
- `data/accounts` contains commander records and recovery-key hashes.
- `data/content` contains installed content packs.

Cloudflare deployments use D1 tables for rooms and accounts. Both backends implement the same service interfaces. Disk mode supports one application process. D1 is the supported hosted persistence path for this release.

## Synchronization

Active room clients use an authenticated 20-second long-poll request. The server returns immediately when the room revision changes. A client interruption falls back to the existing authenticated room synchronization and then reconnects. Private room tokens are sent in request bodies, never query strings.

This is not a WebSocket transport. It intentionally avoids requiring a stateful socket service while providing faster updates than the previous fixed 1.2-second polling loop.

## Operational controls

- Per-address request limits protect account, room, command, and synchronization endpoints from accidental or abusive bursts.
- `/api/health` reports release, storage backends, schema versions, live synchronization mode, uptime, and bounded diagnostic status.
- As of 0.23.1, client error reports accept only a fixed render-failure category. Arbitrary error messages, paths, source text, credentials, and game data are discarded.
- The self-hosted backup and restore scripts include profiles alongside rooms and content.
- Privacy, terms, profile export, and profile deletion controls are available in the application.

## Next production steps

Native wrappers, store compliance, accessibility certification, content delivery, push notifications, crash-reporting vendor integration, automated deployment promotion, multi-region storage, customer support tooling, and commerce remain future work. Version 0.33.13 retains verified email identity, account/profile management, closed-beta diagnostics, and complete Shattered Reach construction access while unifying the Habitat build workflow.

## Historical 0.26.0 identity and operations update

Version 0.26.0 replaces the original profile record with Commander Identity schema 2. Apple and Google use server-validated OpenID Connect authorization codes, Steam uses validated OpenID 2.0 assertions, and raw provider subjects are stored only as hashes. Sessions are device-specific, revocable, time-bounded HttpOnly cookies, while a separately stored recovery key can rotate every active session.

Solo games and interface preferences now synchronize through the same account boundary. Concurrent save writes preserve the rejected upload as a conflict copy instead of overwriting either version. Horizon Operations provides role-gated aggregate health and account support tools with mandatory reasons and an account-local audit trail. It never exposes credentials, provider subject hashes, private Orders, Hidden Objectives, surveys, or room-private information.

The current account storage is Commander Identity schema 3. Existing schema 2 records are normalized in place; deployments should still back up `data/accounts` before upgrading. See `docs/COMMANDER_IDENTITY.md` for deployment configuration.
