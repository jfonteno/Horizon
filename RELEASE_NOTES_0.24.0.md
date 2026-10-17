# Horizon 0.24.0: Installable Application Foundation

Horizon 0.24.0 turns the network playtest into an installable application release candidate. It adds a standalone web app manifest, platform icons, application shortcuts, offline startup handling, safe update activation, connectivity status, and a dedicated install prompt. Dynamic room and API traffic remain network-only so an offline cache can never impersonate authoritative game state.

Create and Join now use the commander-profile-aware network path from the visible application shell. Multiple authenticated players behind one shared address receive independent credential rate limits while retaining a broader household abuse limit.

Settings now include reduced motion, larger interface text, high contrast, soundtrack enablement and volume, fullscreen entry, and installed-display status. The skip-to-content link and strengthened keyboard focus treatment improve keyboard access. Lobby soundtrack preferences share the same durable settings record while retaining migration compatibility with 0.23.2.

## Installation

Deploy Horizon over HTTPS and use the in-app **Install Horizon** action, or the browser's application installation control. Existing self-hosted deployments can be upgraded in place after backing up `data/accounts`, `data/rooms`, and `data/content`.

## Validation

`npm run validate:app` checks application metadata, icon dimensions, offline and update protections, legal routes, version alignment, release notes, and distribution documentation. The normal lint, type, test, build, self-host, backup, and restore checks remain required for publication.

## Known distribution boundary

This release is an installable PWA, not a signed Microsoft Store, macOS, or Steam binary. The current application relies on same-origin server routes for authoritative network play. Native packaging requires a deliberate hosted-shell or local-server-sidecar architecture plus platform signing credentials. See `docs/APP_DISTRIBUTION.md`.
