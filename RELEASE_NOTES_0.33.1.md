# Horizon 0.33.1

Horizon 0.33.1 completes the first closed-beta Commander account experience. Players can create or resume a persistent account through passwordless email verification, use configured Google, Steam, or Apple identity providers, link additional sign-in methods to an existing recovery profile, and manage their complete account from a dedicated Commander Profile page.

## Commander Profile

- Adds a dedicated profile page separate from interface Settings.
- Shows completed games, victories, win rate, Gate successes, highest Legacy, total Legacy, trades, and combat victories.
- Shows all playable faction emblems with exact progress toward the three-win unlock requirement.
- Shows recent eligible multiplayer results, linked rooms, expansion access, linked identities, and active devices.
- Retains display-name editing, recovery-key management, data export, session revocation, sign-out, and deletion controls.

## Verified identity

- Adds passwordless email sign-in using an eight-digit code that expires after ten minutes.
- Supports live delivery through Resend and explicit server-console delivery for host-supervised tests.
- Stores only a one-way hash of the normalized email identity and a masked label in the Commander record.
- Prevents one email or platform identity from being linked to multiple Commander accounts.
- Allows existing recovery-only accounts to add email or platform sign-in without losing games, statistics, or emblems.
- Preserves room invitations through account creation and returns the player to the requested room.

## Hosting and security

- Native Windows hosting creates and preserves a strong authentication secret automatically and enables Steam sign-in by default.
- Adds `horizon-auth.env.example` for email, Google, Apple, Operations-owner, and Steam configuration.
- Includes the generated Windows authentication secret in self-hosted data backups.
- Reports configured identity providers through startup status and `/api/health`.
- Applies separate start and verification rate limits to passwordless email requests.
- Keeps authentication and account responses uncached and uses HttpOnly, same-site cookies for verification state and sessions.

## Compatibility

Commander schema remains version 3. Existing 0.33.0 accounts, recovery keys, sessions, rooms, statistics, emblems, cloud saves, and expansion entitlements remain compatible. Live email, Google, and Apple sign-in still require credentials from their respective providers and must be configured only on the host server.
