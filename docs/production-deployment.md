# Production Deployment Walkthrough — Atlas Massage

## 1. Server Prerequisites

On a fresh Ubuntu/Debian VPS:

```bash
# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 15+
sudo apt-get install -y postgresql postgresql-contrib

# Nginx
sudo apt-get install -y nginx

# PM2
npm install -g pm2

# Certbot (TLS)
sudo apt-get install -y certbot python3-certbot-nginx
```

---

## 2. Clone and Install

```bash
git clone <your-repo> /var/www/atlasmassage
cd /var/www/atlasmassage
npm install
```

---

## 3. PostgreSQL Setup

```bash
sudo -u postgres psql <<EOF
CREATE DATABASE atlasmassage;
CREATE USER atlas WITH ENCRYPTED PASSWORD 'your_strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE atlasmassage TO atlas;
EOF
```

---

## 4. Environment File

```bash
cp .env.example apps/api/.env
nano apps/api/.env
```

Set every value in the file. Key changes from the example:

```env
NODE_ENV=production
PORT=3001

# Database — use the postgres user you created above
DB_HOST=localhost
DB_NAME=atlasmassage
DB_USER=atlas
DB_PASSWORD=your_strong_password_here
DB_SSL=false          # true if your host requires SSL connections

# Secrets — generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_SECRET=<64-char random hex>
JWT_REFRESH_SECRET=<different 64-char random hex>

# Your live domain (no trailing slash)
CORS_ORIGIN=https://atlasmassage.com
APP_URL=https://atlasmassage.com
API_URL=https://atlasmassage.com

# Log level — use 'warn' in production to reduce noise
LOG_LEVEL=warn
```

---

## 5. Stripe Setup

**In the Stripe dashboard (make sure you're in Live mode, not Test):**

1. Go to **Products → Add Product** and create your three membership plans:
   - Essentials — $120/month recurring
   - Wellness — $200/month recurring
   - Unlimited — $360/month recurring
2. Copy each **Price ID** (starts with `price_live_...`)
3. Go to **Developers → API keys** and copy your **Secret key** (`sk_live_...`) and **Publishable key** (`pk_live_...`)
4. Go to **Developers → Webhooks → Add endpoint**:
   - URL: `https://atlasmassage.com/api/v1/payments/webhook`
   - Events to listen for: `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.payment_succeeded`, `customer.subscription.deleted`
   - Copy the **Signing secret** (`whsec_...`)

Update `.env`:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Update the production seed** with the real live Price IDs — the file currently has placeholder IDs from a test account.
Edit `apps/api/src/database/production-seed.js` lines 57–73:

```js
const MEMBERSHIP_PLANS = [
  { ..., stripePriceId: 'price_live_...' },   // Essentials
  { ..., stripePriceId: 'price_live_...' },   // Wellness
  { ..., stripePriceId: 'price_live_...' },   // Unlimited
];
```

**Also update the frontend** — locate the Stripe publishable key and set it to your live key:

```bash
grep -r "pk_test\|VITE_STRIPE" /var/www/atlasmassage/apps/web/src
```

If it's in a Vite env file, set `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...` in `apps/web/.env.production`.

---

## 6. Email (SMTP)

The email service (`apps/api/src/services/emailService.js`) sends if `EMAIL_HOST` is set, otherwise logs to console. For production, choose an SMTP provider:

**Postmark** (recommended — deliverability-focused, free up to 100/month):

1. Sign up at postmarkapp.com → create a Server → get API token
2. Add and verify your sender domain (DNS TXT record)

```env
EMAIL_HOST=smtp.postmarkapp.com
EMAIL_PORT=587
EMAIL_USER=<your-postmark-api-token>
EMAIL_PASSWORD=<same-api-token>
EMAIL_FROM=noreply@atlasmassage.com
```

**SendGrid** alternative:

```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=<your-sendgrid-api-key>
EMAIL_FROM=noreply@atlasmassage.com
```

---

## 7. Twilio SMS

1. Sign up at twilio.com → create a project
2. Get a phone number (US local number, ~$1/month)
3. From the Twilio console dashboard, copy **Account SID** and **Auth Token**

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+15551234567   # the Twilio number you purchased
```

The SMS service (`apps/api/src/services/smsService.js`) detects placeholder values and falls back to console-log — it becomes live the moment you set real credentials.

---

## 8. Run Migrations and Production Seed

```bash
cd /var/www/atlasmassage

# Run all migrations
NODE_ENV=production npm run migrate --workspace=apps/api

# Seed reference data (membership plans, services, business hours, testimonials, owner accounts)
# This script refuses to run unless NODE_ENV=production
NODE_ENV=production npm run seed:production --workspace=apps/api
```

> **Note:** The seed inserts `benmvachon@gmail.com` with password `changeme123!`. Change that password immediately after first login.

---

## 9. Build the Frontend

```bash
cd /var/www/atlasmassage
npm run build --workspace=apps/web

# Copy the build output to the nginx web root
sudo mkdir -p /var/www/atlasmassage/web
sudo cp -r apps/web/dist/* /var/www/atlasmassage/web/
sudo chown -R www-data:www-data /var/www/atlasmassage/web
```

---

## 10. Start the API with PM2

```bash
cd /var/www/atlasmassage/apps/api

# Start with the production ecosystem config
pm2 start ecosystem.config.js --env production

# Save the process list so it survives reboots
pm2 save
pm2 startup   # follow the printed instructions to register the init service
```

Check it's running:

```bash
pm2 status
curl http://localhost:3001/health
```

The PM2 config runs in cluster mode (`instances: 'max'`) across all CPU cores with a 512 MB memory ceiling per instance and auto-restart on crashes.

---

## 11. Nginx and TLS

> **`infrastructure/nginx.conf` is a starting template, not the deployed file.**
> It is copied *once* at provisioning time and then maintained by hand on each
> server. Editing it in the repo changes nothing on a running box. Real servers
> diverge quickly — certbot rewrites the certificate paths, and staging uses a
> different hostname, a Cloudflare origin certificate, and a different web root.
> Always read the live config before changing anything (see §11.2).

Copy the existing config (already written for your domain):

```bash
sudo cp /var/www/atlasmassage/infrastructure/nginx.conf /etc/nginx/sites-available/atlasmassage
sudo ln -s /etc/nginx/sites-available/atlasmassage /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test the config
sudo nginx -t
```

Get a free TLS certificate via Let's Encrypt:

```bash
sudo certbot --nginx -d atlasmassage.com -d www.atlasmassage.com
```

Certbot will auto-update the nginx config with the real certificate paths (the paths in `infrastructure/nginx.conf` are placeholders) and configure auto-renewal.

```bash
sudo systemctl enable nginx
sudo systemctl restart nginx
```

### 11.1 Assets that live outside the web root

The SPA build is the nginx `root`, but two asset trees are **not** part of it —
they live in the API's checkout and are written to at runtime by owner uploads:

| URL prefix        | On disk                                          |
|-------------------|--------------------------------------------------|
| `/headshots/`     | `apps/api/public/headshots/`                     |
| `/essays/images/` | `apps/api/public/essays/images/`                 |

Every one of these needs its own `location`. Without one the request falls
through to the SPA fallback (`try_files $uri $uri/ /index.html`), which answers
**200 with `text/html` and the index.html shell** — an image URL that looks
successful but renders blank. That is the signature of a missing block here.

Serve them straight from disk rather than proxying static files through Node:

```nginx
location /headshots/ {
    alias /var/www/atlasmassage/apps/api/public/headshots/;
    expires 30d;
}

location /essays/images/ {
    alias /var/www/atlasmassage/apps/api/public/essays/images/;
    expires 30d;
}
```

Note the **trailing slash on both the location and the `alias`** — omitting
either breaks path joining. The API must still be able to write to these
directories, so they stay owned by the user PM2 runs as, not `www-data`.

`expires 30d` is safe because replacing an image through the dashboard writes a
new generated filename and repoints the database row — a live URL's bytes never
change. Use `expires`, **not** `add_header Cache-Control`: a single `add_header`
inside a `location` discards every inherited one, silently stripping the
security headers from these responses.

PDFs are deliberately excluded. `apps/api/public/essays/pdfs/` must **never**
get a `location` block — downloads go through `GET /api/v1/essays/:slug/pdf` so
they stay gated on the essay being published. See ADR-0013.

### 11.2 Finding and editing the live config

The file is normally `/etc/nginx/sites-available/atlasmassage`, symlinked from
`sites-enabled/`. Confirm rather than assume — `nginx -T` dumps the fully
resolved config with a marker before each included file:

```bash
sudo nginx -T | grep -E '^# configuration file'          # every file in play
sudo grep -rn server_name /etc/nginx/sites-enabled/ /etc/nginx/conf.d/
```

Add location blocks **inside the `listen 443` server block** for that hostname.
Then:

```bash
sudo cp /etc/nginx/sites-available/atlasmassage{,.bak}   # certbot writes here too
sudo nginx -t && sudo systemctl reload nginx
```

### 11.3 When a fix does not appear to take

If Cloudflare fronts the server (a `/etc/ssl/cloudflare/origin.pem` certificate
is the tell), it caches by file extension and **will have cached the broken
`text/html` responses**. Test each layer bottom-up to find where it breaks:

```bash
# 1. Express directly — bypasses nginx and Cloudflare
curl -I http://127.0.0.1:3001/essays/images/<file>.jpg

# 2. nginx directly — bypasses Cloudflare
curl -I --resolve <domain>:443:127.0.0.1 https://<domain>/essays/images/<file>.jpg

# 3. Through Cloudflare — compare cf-cache-status
curl -I https://<domain>/essays/images/<file>.jpg
```

The layer where `Content-Type` stops being `image/jpeg` is the one at fault. If
only step 3 is wrong, purge the Cloudflare cache for those URLs.

---

## 12. Verify End-to-End

```bash
# API health through nginx
curl https://atlasmassage.com/health

# Public API endpoint
curl https://atlasmassage.com/api/v1/services

# Test Stripe webhook delivery (requires Stripe CLI)
stripe listen --forward-to https://atlasmassage.com/api/v1/payments/webhook
```

Log monitoring:

```bash
pm2 logs atlas-api --lines 50
tail -f /var/log/atlasmassage/api-error.log
```

---

## 13. Encrypted Backups

`scripts/backup.sh` (run by `atlas-backup.timer`) encrypts every dump with
[age](https://age-encryption.org) before it touches disk. The database contains
client health records; unencrypted dumps sitting in `/var/backups` were the
single largest exposure in the old setup. See `docs/adr/ADR-0014-phi-handling.md`.

### Generating the key — do this on your laptop, not the server

```bash
age-keygen -o atlas-backup-key.txt
# Public key: age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
```

Store `atlas-backup-key.txt` somewhere durable and off this server — a password
manager entry and one offline copy. **If you lose it, every backup is
permanently unreadable.** There is no recovery path; that is the point.

### Configuring the server

Add the **public** key to `/var/www/atlasmassage/apps/api/.env`:

```bash
BACKUP_AGE_RECIPIENT=age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
```

Install age and run the job once by hand:

```bash
sudo apt install age
sudo systemctl start atlas-backup.service
tail -20 /var/log/atlasmassage/backup.log
```

The script **fails closed**: if `age` is missing or `BACKUP_AGE_RECIPIENT` is
unset it exits non-zero and writes nothing. A loudly failing backup gets fixed;
a silently plaintext one does not. Do not "fix" a failure by removing the check.

### Restoring

Restore requires the private key, so do it on the machine that holds it:

```bash
scp deploy@atlasmassage.com:/var/backups/atlasmassage/daily/atlas_2026-08-03_020000.dump.age .
age -d -i atlas-backup-key.txt atlas_2026-08-03_020000.dump.age > restored.dump
pg_restore -h localhost -U atlas -d atlasmassage_restore restored.dump
```

**Verify a restore now, not during an incident.** An encrypted backup you have
never decrypted is not yet a backup.

### Migrating from the old plaintext backups

Any pre-existing `*.dump` files are unencrypted clinical data. Once you have
confirmed an encrypted restore works, delete them:

```bash
find /var/backups/atlasmassage -name '*.dump' -not -name '*.dump.age' -delete
```

The backup script warns about leftovers on every run until they are gone.

---

## The `deploy` User

CI deploys over SSH. `.github/workflows/ci.yml` runs, on every push to `main`
that passes lint/test/build:

```yaml
uses: appleboy/ssh-action@v1
with:
  host:     ${{ secrets.DEPLOY_HOST }}
  username: ${{ secrets.DEPLOY_USER }}
  key:      ${{ secrets.DEPLOY_SSH_KEY }}
  script:   /home/deploy/atlas-deploy.sh
```

Two things follow from that, and both are easy to trip over:

- **`atlas-deploy.sh` is not in this repository.** It exists only at
  `/home/deploy/atlas-deploy.sh` on the server. It is not version-controlled,
  not reviewed, and not backed up. Read it before assuming what a deploy does.
- **Authentication is key-based, not password-based.** The account is expected
  to have a locked password (`adduser --disabled-password`), which is correct
  and not a problem to fix.

`infrastructure/atlas-backup.service` also runs as `User=deploy`.

### Passwords and sudo

A locked password does **not** stop you from acting as `deploy`.
`sudo -u deploy <cmd>` authenticates *you* and checks *your* sudoers entry for
permission to run as that user — it never prompts for the target's password.
(`su - deploy` does, which is why it fails on a `--disabled-password` account.)

If the deploy script contains `sudo` — the frontend steps in §9 do
(`sudo cp`, `sudo chown`) — then `deploy` must have **`NOPASSWD`** sudo. A
non-interactive SSH session cannot answer a password prompt; it would hang and
the deploy would fail. Verify rather than assume:

```bash
sudo passwd -S deploy    # P = password set, NP = none, L = locked
sudo -l -U deploy        # what deploy may run via sudo
sudo -l                  # what YOU may run, and as which users
sudo grep -rn deploy /etc/sudoers /etc/sudoers.d/
```

### Which user runs what

| Task | Run as |
|---|---|
| `nginx -t`, `systemctl reload nginx`, editing `/etc/nginx/**` | you, with `sudo` (needs root) |
| Application deploy (pull, build, `pm2 reload`) | `deploy`, via CI |
| Writing to `apps/api/public/**` (uploads) | the user PM2 runs as |

Administering nginx is a root task. There is no reason to become `deploy` for
it — that account exists to deploy the application, not to configure the server.

---

## Per-Server Facts Worth Recording

These differ between environments and are **not** derivable from this repo.
Fill in as they are established, so the next person does not have to guess.

| | Production | Staging |
|---|---|---|
| Hostname | `atlasmassage.com` | `blorvis.com` |
| TLS | Let's Encrypt via certbot | Cloudflare origin cert (`/etc/ssl/cloudflare/origin.pem`) |
| Fronted by Cloudflare | — | yes (caches by extension; purge after asset fixes) |
| nginx web root | `/var/www/atlasmassage/web` (copied build) | `/var/www/atlasmassage/apps/web/dist` (built in place) |
| nginx site file | `/etc/nginx/sites-available/atlasmassage` | `/etc/nginx/sites-available/atlasmassage` |

Note the web roots differ: production copies `dist/` to a separate directory
(§9), staging serves it directly out of the checkout. A `root` path copied
between the two will silently serve nothing.

---

## Checklist

| Item | Location |
|---|---|
| Change owner account passwords | First login after seed |
| Stripe Price IDs updated (live mode) | `apps/api/src/database/production-seed.js:57–73` |
| Stripe publishable key set (live mode) | `apps/web/.env.production` |
| Sender domain verified in SMTP provider | Provider dashboard |
| Twilio phone number purchased | Twilio console |
| Stripe webhook endpoint registered | Stripe → Developers → Webhooks |
| TLS cert auto-renewal confirmed | `sudo certbot renew --dry-run` |
| PM2 startup init service registered | Output of `pm2 startup` |
| `/headshots/` and `/essays/images/` location blocks present | §11.1 |
| Essay hero images present on disk after deploy | `ls apps/api/public/essays/images/` |
| Cloudflare cache purged after any asset-routing fix | §11.3 |
| `age` installed and `BACKUP_AGE_RECIPIENT` set | §13 |
| Backup private key stored off-server | §13 |
| Encrypted restore verified at least once | §13 |
| Legacy unencrypted `*.dump` files deleted | §13 |
