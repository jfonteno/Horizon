# Self-hosting Horizon 0.17.2

This deployment runs one authoritative Horizon server on a physical Linux host. Room state is stored in atomic JSON files on the host, so games survive container and machine restarts. This release supports one Horizon application replica. Do not scale the `horizon` service above one instance while using disk storage.

## Requirements

- A machine with Docker Engine and Docker Compose v2
- A current backup location outside the Horizon project directory
- Optional: a domain in Cloudflare for public access without opening an inbound router port

## Start on the server

```bash
cp .env.self-host.example .env
mkdir -p data/rooms data/content backups
# Set HORIZON_UID and HORIZON_GID in .env to the values from `id -u` and `id -g`.
docker compose up -d --build
curl --fail http://127.0.0.1:3000/api/health
```

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

Backups are written to `./backups` and retained for 14 days by default. Copy them to a different disk or backup service. Override the paths or retention with `HORIZON_DATA_DIR`, `HORIZON_BACKUP_DIR`, and `HORIZON_BACKUP_RETENTION_DAYS`.

Version 0.17 backups include both persistent rooms and installed Content Packs. See [CONTENT_PACKS.md](CONTENT_PACKS.md) for installation and validation.

Restore a backup only after stopping Horizon. Existing room data is moved to a timestamped recovery directory before extraction:

```bash
docker compose stop horizon
HORIZON_RESTORE_CONFIRM=YES npm run restore:self-hosted -- backups/horizon-data-YYYYMMDDTHHMMSSZ.tar.gz
docker compose start horizon
```

Update after pulling a verified release:

```bash
npm test
docker compose up -d --build
curl --fail http://127.0.0.1:3000/api/health
```

Room files are compatible across process restarts and are migrated through the same room normalization layer used by the multiplayer API. Keep the previous source release and a current backup for rollback.

## Storage boundary

Disk storage is intended for one physical server and one application process. Cloudflare Workers deployments continue to use D1. A future PostgreSQL repository can replace disk storage through the existing `RoomRepository` interface when horizontal scaling is needed.
