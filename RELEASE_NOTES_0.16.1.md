# Horizon: Shattered Reach 0.16.1

## Self-Hosted Deployment

- Added a production Docker image and one-command Docker Compose deployment.
- Added durable, atomic disk-backed multiplayer room storage for a single physical server.
- Added restart-safe room recovery and exact compare-and-swap protection for concurrent commands.
- Added `/api/health` readiness reporting for the application and active storage adapter.
- Added graceful shutdown so deployments can drain active connections before stopping.
- Added an optional Cloudflare Tunnel profile that exposes HTTPS without opening an inbound router port.
- Added backup retention and confirmation-gated restore tools that preserve displaced room data.
- Added GitHub Container Registry publishing for main branch and version tag builds.
- Added self-hosting, Tunnel, update, recovery, and single-replica operating documentation.
- Added automated persistence, corruption, and concurrent revision tests.

## Deployment boundary

Disk-backed rooms support one Horizon application process. Cloudflare Worker deployments retain D1 support. Multi-replica hosting should wait for a shared database adapter such as PostgreSQL.
