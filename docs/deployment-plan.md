# Deployment Plan

## Infrastructure

| Component | Technology | Notes |
|-----------|-----------|-------|
| Server | Cloudflare-hosted Linux VPS | |
| Reverse proxy | Nginx | TLS termination, static file serving |
| Process manager | PM2 (cluster mode) | See [ADR-0009](adr/ADR-0009-pm2-process-management.md) |
| Database | PostgreSQL | Self-hosted on same server; move to managed DB for scale |
| DNS / CDN | Cloudflare | Proxied A record; SSL Full (Strict) mode |

## Deployment Workflow

```
Developer pushes to main
  → GitHub Actions CI runs (lint + test + build)
  → On success: manual deploy trigger (or CD pipeline)
    1. SSH to server
    2. git pull origin main
    3. npm ci --workspaces
    4. npm run build --workspace=apps/web
    5. npm run migrate --workspace=apps/api
    6. pm2 reload ecosystem.config.js --update-env
    7. Copy web/dist/ to /var/www/atlasmassage/web/
    8. Reload nginx
```

## PM2 Configuration

See `apps/api/ecosystem.config.js`. Key settings:

- `instances: 'max'` — one worker per CPU core
- `exec_mode: 'cluster'` — zero-downtime reload via `pm2 reload`
- `max_memory_restart: '512M'` — auto-restart on memory leak
- Logs to `/var/log/atlasmassage/`

## Environment Variables

Production `.env` must set:
- Strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (64+ chars, generated with `openssl rand -base64 64`)
- `DB_PASSWORD` with a strong password
- `NODE_ENV=production`
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
- `TWILIO_*` credentials
- `EMAIL_*` credentials (see below)

## Email setup

### Development

Leave `EMAIL_HOST` empty (or unset) in `.env`. The email service logs all outgoing
emails to the console via Winston. Password reset links appear in the server log
and can be copied directly into the browser.

### Production

The email service uses standard SMTP and works with any provider. Recommended options:

| Provider | Notes |
|----------|-------|
| **Postmark** | Best deliverability for transactional email; generous free tier |
| **Resend** | Modern API-first provider; easy setup |
| **SendGrid** | Widely used; free tier available |
| **Gmail SMTP** | Works for low volume; requires App Password if 2FA is enabled |

**Steps (using Postmark as an example):**

1. Create a Postmark account and add a verified sender domain or address.
2. Get your server API token from the Postmark dashboard.
3. Set these values in the production `.env`:

```
EMAIL_HOST=smtp.postmarkapp.com
EMAIL_PORT=587
EMAIL_USER=<your-server-api-token>
EMAIL_PASSWORD=<your-server-api-token>
EMAIL_FROM=noreply@atlasmassage.com
APP_URL=https://atlasmassage.com
```

> `EMAIL_FROM` must match a verified sender address in your provider account.
> `APP_URL` is embedded in the password reset link — set it to the production domain.

4. Send a test reset email to confirm delivery before going live:
```bash
curl -X POST https://atlasmassage.com/api/v1/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"your-test-address@example.com"}'
```

### Currently implemented email templates

| Template | Trigger | File |
|----------|---------|------|
| Password reset | `POST /auth/forgot-password` | `apps/api/src/services/emailService.js` |

Appointment confirmation and reminder emails are planned for Phase 5.

## Database Backups

- Daily `pg_dump` cron job to compressed file
- Rotate: keep 7 daily, 4 weekly
- Off-server copy recommended (S3, Backblaze B2, etc.)

## Zero-Downtime Deploys

PM2 cluster mode supports `pm2 reload` which performs a rolling restart:
1. Fork new workers
2. Wait for new workers to become ready (listen on port)
3. Gracefully shut down old workers (SIGTERM → drain → SIGKILL after 10s)

## Rollback

```bash
# Roll back to previous deployment
git checkout <previous-commit>
npm ci --workspaces
npm run build --workspace=apps/web
npm run migrate:rollback --workspace=apps/api  # if migration was applied
pm2 reload ecosystem.config.js --update-env
```

## Monitoring (Future)

- Health check endpoint: `GET /health`
- PM2 dashboard: `pm2 monit`
- External uptime monitoring: Betteruptime, UptimeRobot, or similar
- Log aggregation: Loki + Grafana (future)
- Error tracking: Sentry (future)
