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
