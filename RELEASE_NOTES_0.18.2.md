# Horizon: Shattered Reach 0.18.2

## Native Windows production hosting

- Fixed compiled CSS and JavaScript returning `404 Not Found` when Horizon runs directly on Windows.
- Added a Horizon-owned Windows static asset compatibility layer for files under `dist/client`.
- Correctly serves JavaScript, CSS, images, fonts, JSON, SVG, and map tiles with secure content types and cache headers.
- Preserves Vinext handling for application routes, multiplayer APIs, private room views, playtest reports, and server-rendered pages.
- Prevents path traversal and does not expose Vinext's internal `.vite` build metadata.

## Windows launcher

- Added `Start-Horizon-Windows.cmd` to the release package.
- Uses `npm.cmd` so restrictive PowerShell execution policies do not block setup.
- Installs dependencies and rebuilds automatically when the Horizon version changes.
- Creates durable room, content, and backup directories.
- Binds Horizon to `127.0.0.1:3000` for tunnel-only public access.
- Verifies both `/api/health` and a compiled stylesheet before opening the game.
- Detects the installed Cloudflare Windows connector and opens `https://play.horizongame.us` when available.

## Compatibility

- Existing 0.17.x and 0.18.x room files remain compatible.
- The 0.18.1 lobby faction draft remains unchanged.
- Docker, Linux, and Cloudflare Workers deployments remain unchanged.
- No Cloudflare Tunnel route or token changes are required when upgrading from 0.18.1.

## Validation target

- Production standalone build
- Lint and TypeScript checks
- Full automated rules, multiplayer, persistence, privacy, and AI suite
- Windows static-asset regression test
- Release archive integrity check
