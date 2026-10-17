# Horizon 0.23.1: Recovery and Synchronization Stabilization

This patch addresses the gaps found during the 0.23.0 source audit.

- Reopening or converting a seat revokes its previous commander-profile association. Existing unclaimed seats with stale associations are normalized on read.
- Temporary profile-loading failures retain the browser's recovery key and show a retry control. Entered keys are saved only after successful authentication.
- Returning devices recover invalidated room tokens through their commander profile. Explicit Recover Room links invoke recovery even if an old room token exists.
- Delayed responses cannot replace newer room revisions in the interface or browser storage.
- Failed long-poll requests fall back to ordinary authenticated polling with a delay before reconnecting.
- Client diagnostics send only a fixed render-failure category. Arbitrary messages, paths, and source text are discarded by the endpoint.
- Profile updates use update-only persistence, preventing concurrent updates from recreating deleted profiles in memory, disk, or D1 storage.
- Cloudflare deployments use shared atomic D1 rate-limit counters. Addresses are hashed before persistence and expired counters are removed. Single-process self-hosted deployments use bounded in-memory limits.

## Upgrade

Stop Horizon, back up the complete data directory, extract this release into a new folder, and copy the existing data directory into it. Start with Start-Horizon-Windows.cmd. Keep data/accounts as well as data/rooms and data/content. The launcher rebuilds for 0.23.1. No tunnel route changes are needed.

Room schema remains 6 and profile schema remains 1. D1 rate-limit storage is created automatically. Existing account keys remain valid. Retain an offline copy of your recovery key.

## Scope

This is a stabilization patch, not native packaging or platform sign-in. Disk storage still supports one process. Self-hosted rate limits reset on restart and should sit behind a trusted proxy; direct untrusted clients must not be allowed to spoof forwarded-address headers. D1 counters are shared across Worker instances, but broader load testing remains future work.
