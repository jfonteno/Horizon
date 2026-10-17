# Application Distribution

Horizon 0.32.0 ships as an installable progressive web application backed by the existing Horizon server. This is the supported application package for this release because network rooms, account recovery, authoritative commands, private messaging, diagnostics, strategic AI, reminders, and persistence depend on same-origin server routes.

## Installable application

Deploy Horizon over HTTPS, open it in a supported browser, and choose **Install Horizon** from the browser's application menu. The installed application prefers fullscreen presentation and gets Create, Join, and Continue shortcuts. Application updates activate silently from menu screens, while live rooms are never reloaded automatically. Live rooms and API responses are never cached by the service worker.

The browser install flow is the client distribution path for Windows, macOS, ChromeOS, Android, and compatible Linux environments. On iPhone and iPad, use the browser's Add to Home Screen action.

## Release gate

Run this before publishing:

```bash
npm run lint
npm run typecheck
npm test
npm run validate:app
npm run build
```

After deployment, verify `/api/health`, create a room, join it from a second profile on the same network, install the application, reload an update, and confirm that an offline launch shows the Horizon offline screen without exposing stale room state.

If platform sign-in is enabled, also verify every configured provider against its exact production callback URL, revoke a second device session, exercise a cloud-save conflict, and confirm `/admin` denies an ordinary player account. Provider setup and Operations ownership are documented in `COMMANDER_IDENTITY.md`.

## Windows hosting versus a native client

`Start-Horizon-Windows.cmd` runs the persistent Horizon server on Windows. It is not a signed desktop client installer. Players should install the hosted PWA from the browser.

A future native wrapper must preserve the server boundary. A shell that packages only the rendered interface would break rooms, accounts, health checks, persistence, and synchronization. The two valid architectures are:

1. A signed shell that opens the production HTTPS origin. This is a thin client and still requires connectivity.
2. A signed shell that manages a bundled local Horizon server sidecar, an isolated data directory, port allocation, migrations, backups, and clean shutdown.

Tauri 2 is the preferred wrapper candidate because it supports Windows installers and CI release pipelines. Do not begin store submission until the architecture above is selected and these external items exist:

- Windows code-signing certificate and publisher identity
- Apple Developer account, bundle identifier, signing, and notarization access
- Store listing copy, screenshots, age rating, support URL, and privacy URL
- Production domain, monitoring, backup policy, and support ownership
- Installer update-channel and rollback policy

Current Tauri references:

- https://v2.tauri.app/start/prerequisites/
- https://v2.tauri.app/distribute/windows-installer/
- https://v2.tauri.app/distribute/pipelines/github/

Native wrappers are therefore a distribution follow-up, not a blocker for the 0.32.0 installable web application.
