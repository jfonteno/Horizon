# Self-hosting Horizon 0.33.15

This deployment runs one authoritative Horizon server on Windows or a physical Linux host. Room state is stored in atomic JSON files on the host, so games survive process, container, and machine restarts. This release supports one Horizon application replica. Do not scale Horizon above one instance while using disk storage.

## Requirements

- Native Windows: Node.js 22.13.0 or newer
- Linux or Docker Desktop: Docker Engine and Docker Compose v2
- A current backup location outside the Horizon project directory
- Optional: a domain in Cloudflare for public access without opening an inbound router port

## Start directly on Windows

Place `Start-Horizon-Windows.cmd` beside `package.json` and double-click it. The launcher installs dependencies when required, builds the standalone server, creates persistent data directories, starts Horizon on `127.0.0.1:3000`, and verifies a compiled stylesheet before opening the site.

On first launch, Windows creates a durable identity-signing secret in `data/auth-secret` and enables Steam sign-in. To enable live email, Google, or Apple sign-in, copy `horizon-auth.env.example` to `horizon-auth.env`, add the relevant provider credentials, and restart Horizon. The completed configuration file contains secrets and must never be shared or copied into a release archive.

For a Cloudflare connector installed as a Windows service, configure the published application service URL as:

```text
http://127.0.0.1:3000
```

Keep the Horizon Server window open during play. Stop it with `Ctrl+C`. The Cloudflare connector may run automatically as a Windows service, but Horizon must be launched again after a restart unless it is separately configured as a service or scheduled task.

### Upgrade an active Windows playtest

1. Announce a short pause and stop the existing Horizon Server window with `Ctrl+C`. Wait until it exits before copying data.
2. Copy the entire old `data` directory to a separate backup location. It includes `rooms`, `accounts`, `operations`, installed `content`, and `auth-secret`. Keep the old release folder until the upgraded games have been checked.
3. Extract the new release into a new folder. Before launching it, copy the old `data` directory into that folder beside `package.json`. Also copy `horizon-auth.env` if one exists. Keep its `HORIZON_AUTH_SECRET` value unchanged. Never place credentials inside a release archive.
4. Run `Start-Horizon-Windows.cmd` from the new folder. It installs and builds the new version, then starts the server. Keep the same Cloudflare hostname and connector destination.
5. Open an existing room by its original code, check a Commander profile and My Games, and have one tester reconnect on another device. The release archive excludes live data, so existing accounts and games are retained by copying the data directory.

If the server uses custom `HORIZON_DATA_DIR`, `HORIZON_ACCOUNT_DIR`, `HORIZON_CONTENT_DIR`, or `HORIZON_OPERATIONS_PATH` values, preserve those paths and settings instead of assuming the default `data` directory. Do not run two Horizon servers against the same data simultaneously.

The Windows compatibility layer introduced in 0.18.2 corrects static asset delivery in Vinext 0.0.50 without modifying installed dependencies. It remains enabled only for native Windows hosting.

## Start with Docker

```bash
cp .env.self-host.example .env
mkdir -p data/rooms data/content data/accounts data/operations backups
# Set HORIZON_UID and HORIZON_GID in .env to the values from `id -u` and `id -g`.
docker compose up -d --build
curl --fail http://127.0.0.1:3000/api/health
```

Before inviting account testers, set a long random `HORIZON_AUTH_SECRET` in `.env`. Configure `HORIZON_STEAM_SIGNIN`, passwordless email, Google, or Apple using [Commander Identity](COMMANDER_IDENTITY.md). Docker does not generate an identity secret automatically.

The application is bound to the server's loopback interface by default. This prevents direct internet and LAN access while still allowing the Cloudflare Tunnel container to reach the `horizon` service over the private Compose network.

To expose the port on a trusted LAN instead, change the `ports` entry in `compose.yaml` from `127.0.0.1:${HORIZON_PORT:-3000}:3000` to `${HORIZON_PORT:-3000}:3000`. Use a firewall and do not forward that port directly from the public internet.

## Add Cloudflare Tunnel

Cloudflare is optional. It is useful here as the public HTTPS entrance while the physical server remains the application host and owns all room data.

1. In Cloudflare Zero Trust, create a remotely managed Tunnel.
2. Add a public hostname and set its service URL to `http://horizon:3000`.
3. Copy the Tunnel token into `CLOUDFLARE_TUNNEL_TOKEN` in `.env`.
4. Start the optional profile:

```bash
docker compose --profile tunnel up -d --build
```

No inbound router port is required. Keep the token secret and rotate it if it is exposed.

## Operations

Inspect health and logs:

```bash
curl --fail http://127.0.0.1:3000/api/health
docker compose ps
docker compose logs --tail=200 horizon
```

Create a backup while Horizon is running:

```bash
npm run backup:self-hosted
```

Backups are written to `./backups` and retained for 14 days by default. Version 0.33.15 backups include room files, installed Content Packs, Commander records, persisted Operations settings, and the native Windows authentication secret when present. Copy them to a different disk or backup service. Override the paths or retention with `HORIZON_DATA_DIR`, `HORIZON_CONTENT_DIR`, `HORIZON_ACCOUNT_DIR`, `HORIZON_OPERATIONS_PATH`, `HORIZON_BACKUP_DIR`, and `HORIZON_BACKUP_RETENTION_DAYS`.

See [CONTENT_PACKS.md](CONTENT_PACKS.md) for content installation and validation.

Restore a backup only after stopping Horizon. Existing room data is moved to a timestamped recovery directory before extraction:

```bash
docker compose stop horizon
HORIZON_RESTORE_CONFIRM=YES npm run restore:self-hosted -- backups/horizon-data-YYYYMMDDTHHMMSSZ.tar.gz
docker compose start horizon
```

Update after pulling a verified release:

```bash
docker compose stop horizon
npm run backup:self-hosted
npm test
docker compose up -d --build
curl --fail http://127.0.0.1:3000/api/health
```

When extracting into a new Docker project directory, also copy the old `data` directory and `.env` file before starting Compose. The bind mount `./data:/data` must point to the existing records. Retain the previous directory and backup until active rooms and Commander profiles are confirmed. Browser URLs and account sessions continue to work when the public hostname and authentication secret stay the same.

The validation commands are cross-platform. In PowerShell, use `npm.cmd` if the local execution policy blocks `npm.ps1`, for example `npm.cmd test`.

Room files are compatible across process restarts and are migrated through the same room normalization layer used by the multiplayer API. Version 0.23.0 upgrades room records to schema 6 by adding optional account links; existing rooms remain playable without a profile. Keep the previous source release and a current backup for rollback.

## Storage boundary

Disk storage is intended for one physical server and one application process. Cloudflare Workers deployments use D1 for rooms and commander profiles. A future PostgreSQL repository can replace disk storage through the existing repository interfaces when horizontal scaling is needed.

Commander recovery keys are authentication credentials. Horizon stores only a SHA-256 hash, but anyone holding the original key can recover the profile and rotate its room credentials. Do not place recovery keys in logs, screenshots, environment files, support messages, or source control.
