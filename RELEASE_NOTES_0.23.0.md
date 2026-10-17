# Horizon 0.23.0

## Production Foundation

Horizon 0.23.0 adds the first durable identity and service-operations layer while preserving the current web and native Windows playtest paths.

### Commander profiles

- Create an optional device profile from Settings.
- Store only a hash of the private recovery key on the server.
- Update the commander display name, export profile data, sign out, or delete the profile.
- Link newly created and claimed room seats to the active profile.
- Recover linked rooms on another device and rotate the previous room token.
- Transfer host authority with the recovered host seat.
- Prevent one profile from claiming multiple seats in the same room.

### Durable service data

- Persist profiles in atomic JSON files on native Windows, Linux, and Docker hosts.
- Persist profiles in Cloudflare D1 alongside rooms for hosted deployments.
- Upgrade stored rooms to schema version 6 while retaining compatibility with rooms created by older releases.
- Include account records in self-hosted backup and guarded restore operations.
- Add the D1 account schema migration.

### Live multiplayer and operations

- Replace the fixed foreground polling loop with authenticated long polling.
- Retain ordinary synchronization as a reconnect fallback.
- Apply per-address rate limits to account, room, command, and synchronization endpoints.
- Add structured, bounded diagnostics and a richer health response.
- Add a privacy notice, playtest terms, sanitized client-error reporting, profile export, and profile deletion.

### Deployment notes

- Native Windows remains fully supported through `Start-Horizon-Windows.cmd` and now creates `data/accounts` automatically.
- Docker deployments mount `/data/accounts` with the existing data volume.
- No Cloudflare Tunnel route changes are required.
- Existing rooms do not require profiles and remain resumable with their current room tokens.
- Apple, Google, and Steam sign-in are not enabled in this release. The account model is prepared for those providers, but platform authentication and native wrappers remain future work.

See `docs/PRODUCTION_FOUNDATION.md` for the architecture boundary and remaining app-store work.
