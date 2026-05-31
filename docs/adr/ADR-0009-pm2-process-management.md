# ADR-0009 — PM2 Process Management

**Status**: Accepted

**Date**: 2026-05-31

## Context

The Express API must run continuously in production, survive crashes, restart on server reboot, and deploy without downtime. Running on a multi-core Linux server, we should also take advantage of all CPU cores. We need a process manager that handles all of this without requiring a full container infrastructure (Docker/Kubernetes is out of scope for this deployment size).

## Decision

Use **PM2** in **cluster mode** to manage the API process.

Key configuration (`apps/api/ecosystem.config.js`):
- `instances: 'max'` — PM2 spawns one worker per CPU core
- `exec_mode: 'cluster'` — Node.js cluster; all workers share port 3001 via OS load balancing
- `max_memory_restart: '512M'` — auto-restart on memory leak
- `restart_delay: 4000` — wait 4 seconds between crash restarts to prevent restart storm
- `max_restarts: 10` — stop restarting after 10 consecutive failures (alerts operator)

Zero-downtime deploys: `pm2 reload atlas-api` performs a rolling restart — new workers are started before old workers are stopped.

Graceful shutdown is handled in `server.js`:
- `SIGTERM` → `server.close()` → drain in-flight requests → `closePool()` → `process.exit(0)`
- 10-second hard timeout if drain stalls

## Consequences

### Positive

- Utilizes all CPU cores without any code changes
- `pm2 reload` provides zero-downtime restarts
- PM2 auto-restart survives crashes without operator intervention
- `pm2 startup` generates a systemd service for server reboots
- PM2 log management: rotation built in

### Negative / Trade-offs

- PM2 cluster mode does not share in-memory state between workers (e.g., in-memory caches). This is acceptable because we use stateless JWT and the database for all shared state.
- PM2 is not Docker-native; if the deployment moves to containers, this ADR should be superseded

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| `systemd` unit only | No cluster mode; no zero-downtime reload without additional tooling |
| Docker + docker-compose | Adds containerization overhead; appropriate at larger scale |
| Kubernetes | Overkill for a single-server deployment |
| Nodemon | Development only; not suitable for production |
