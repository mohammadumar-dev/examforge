# HI Tech Examination — Complete Deployment Guide

> **Target:** 5000+ concurrent students · Single exam window (1–2 hours) · Self-hosted server · Local PostgreSQL + PgBouncer + Redis

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Component Concepts Explained](#2-component-concepts-explained)
3. [Server Requirements](#3-server-requirements)
4. [Install System Dependencies](#4-install-system-dependencies)
5. [PostgreSQL Setup & Configuration](#5-postgresql-setup--configuration)
6. [PgBouncer Setup & Configuration](#6-pgbouncer-setup--configuration)
7. [Redis Setup & Configuration](#7-redis-setup--configuration)
8. [Application Deployment](#8-application-deployment)
9. [PM2 Process Manager](#9-pm2-process-manager)
10. [Nginx Reverse Proxy](#10-nginx-reverse-proxy)
11. [Environment Variables Reference](#11-environment-variables-reference)
12. [Load Testing with k6 + Docker](#12-load-testing-with-k6--docker)
13. [Running Tests](#13-running-tests)
14. [Monitoring & Health Checks](#14-monitoring--health-checks)
15. [Troubleshooting](#15-troubleshooting)
16. [Security Hardening](#16-security-hardening)

---

## 1. Architecture Overview

```
                        ┌─────────────────────────────────────────┐
                        │              Internet                    │
                        └─────────────────┬───────────────────────┘
                                          │ HTTPS :443
                        ┌─────────────────▼───────────────────────┐
                        │           Nginx (Reverse Proxy)          │
                        │      SSL termination · Rate limiting     │
                        └─────────────────┬───────────────────────┘
                                          │ HTTP :3000
              ┌───────────────────────────▼──────────────────────────────┐
              │                  PM2 Cluster (Node.js)                    │
              │   Worker 1  │  Worker 2  │  ...  │  Worker N (all CPUs)  │
              │                  Next.js App                              │
              └──────┬──────────────────────────────────┬───────────────┘
                     │                                  │
       ┌─────────────▼──────────┐         ┌────────────▼─────────┐
       │   PgBouncer :6432      │         │    Redis :6379        │
       │   Connection Pool      │         │  Cache · Rate Limit   │
       │   Transaction Mode     │         │  Session · Heartbeat  │
       └─────────────┬──────────┘         └──────────────────────┘
                     │ Max 100 server connections
       ┌─────────────▼──────────┐
       │  PostgreSQL :5432      │
       │  Primary Database      │
       │  max_connections=200   │
       └────────────────────────┘
```

### Request Flow (Student Taking Exam)

```
Student Browser
  │
  ├─► GET  /exam/[slug]               → Nginx → Next.js → Redis (cache) → PgBouncer → Postgres
  ├─► POST /api/exam/[slug]/register  → Next.js → PgBouncer → Postgres (create student + enrollment)
  ├─► POST /api/exam/[slug]/verify-access → Next.js → PgBouncer → Postgres (create session)
  ├─► GET  /api/exam/[slug]/questions → Next.js → Redis (cache hit after first load)
  ├─► POST /api/exam/[slug]/response  → Next.js → PgBouncer → Postgres (save answer)
  ├─► POST /api/exam/[slug]/heartbeat → Next.js → Redis (increment counter, flush every 10s)
  └─► POST /api/exam/[slug]/submit    → Next.js → Postgres (mark submitted) → background scoring
```

---

## 2. Component Concepts Explained

### 2.1 PostgreSQL — The Database

PostgreSQL is the primary data store for everything: admins, students, exams, questions, sessions, responses, and scores.

**Why PostgreSQL?**
- ACID compliant (no data loss on crash)
- Strong support for concurrent writes (row-level locking)
- Excellent performance with proper indexing
- Works perfectly with Prisma ORM

**Key concepts in our setup:**

| Setting | Value | Why |
|---|---|---|
| `max_connections` | 200 | Hard limit on simultaneous connections to PostgreSQL |
| `shared_buffers` | 4GB (25% RAM) | PostgreSQL's own memory cache for data pages |
| `effective_cache_size` | 12GB (75% RAM) | Hint to query planner about available OS cache |
| `work_mem` | 16MB | Memory per sort/join operation |
| `checkpoint_completion_target` | 0.9 | Spread checkpoint I/O over 90% of the interval |

**Why not connect directly from the app?**
With 16 PM2 workers each holding 5 Prisma connections = 80 persistent connections. Under load, this could spike to 200+ and hit `max_connections`. This is why PgBouncer sits in front.

---

### 2.2 PgBouncer — The Connection Pooler

PgBouncer is a lightweight connection proxy that sits between your application and PostgreSQL.

**The core problem it solves:**

Without PgBouncer:
```
16 PM2 workers × 5 Prisma connections = 80 idle connections to PostgreSQL (always open)
Under load: up to 500 concurrent requests → PostgreSQL crashes with "too many connections"
```

With PgBouncer:
```
App connects to PgBouncer (5000 client connections allowed)
PgBouncer maintains only 100 actual connections to PostgreSQL
When app query finishes → connection returned to pool immediately
```

**Pool Modes — what they mean:**

| Mode | How it works | Best for |
|---|---|---|
| `session` | 1 PostgreSQL connection per client connection for the entire session | Full feature compatibility, low concurrency |
| `transaction` | PostgreSQL connection held only during a transaction, then returned to pool | High concurrency — **what we use** |
| `statement` | Connection returned after every single SQL statement | Rarely used, breaks multi-statement transactions |

**We use `transaction` mode** because:
- A Prisma query holds a connection for ~5–50ms, then releases it
- 100 PostgreSQL connections × 20 transactions/second each = **2000 queries/second capacity**
- 5000 students can share 100 connections because no student holds one continuously

**Compatibility note:** PgBouncer transaction mode does not support PostgreSQL features that require session-level state (e.g. SET, LISTEN, advisory locks). Prisma with the `@prisma/adapter-pg` driver works fine in transaction mode.

**Our PgBouncer config explained:**
```ini
pool_mode = transaction         # Release connection after each transaction
max_client_conn = 2000          # App can open up to 2000 connections to PgBouncer
default_pool_size = 100         # Only 100 real connections to PostgreSQL
reserve_pool_size = 20          # Extra 20 for sudden spikes
query_wait_timeout = 10         # If no connection available after 10s → error (not hang forever)
server_idle_timeout = 30        # Close idle PostgreSQL connections after 30s
ignore_startup_parameters = extra_float_digits,options  # Compatibility with pg driver
```

---

### 2.3 Redis — The Cache & Coordination Layer

Redis is an in-memory data store used for:

| Use | Key Pattern | TTL | Why |
|---|---|---|---|
| Exam session cache | `ef:session:{token}` | 60s | Avoids DB read on every API call |
| Exam metadata cache | `ef:exam:{slug}` | 300s | Questions don't change during exam |
| Questions cache | `ef:questions:{examId}` | 300s | Loaded once, served from memory |
| Rate limiting | `ef:rate:{key}` | Per window | Distributed counter across workers |
| Heartbeat counters | `ef:hb:{sessionId}:tab` | 60s | Batch tab-switch counts, flush every 10s |
| Owner lock | `ef:owner:{examId}:{studentId}` | 60s | Prevent two windows submitting |
| Scoring pending | `ef:scoring:{sessionId}` | 120s | Signal to result page that score is loading |

**Why Redis for session caching?**

Without Redis, every API call (save answer, heartbeat, submit) runs:
```sql
SELECT id, examFormId, studentId, startedAt, status FROM ExamSession WHERE sessionToken = ?
```

With 5000 students saving answers every 30 seconds = **167 session reads/second just for validation**.

With Redis (60s TTL), 167 reads/second → **< 3 reads/second** (only on cache miss every 60s).

**Fail-open design:** If Redis crashes, the app continues working. Sessions fall back to DB reads, rate limiting falls back to in-memory, heartbeats are skipped. No exam is lost — just slightly degraded performance.

---

### 2.4 Next.js — The Application

HI Tech Examination runs on Next.js 16 (App Router) in Node.js runtime.

**Key files:**
- `app/api/exam/[slug]/` — Student-facing API routes (rate-limited, session-validated)
- `app/api/admin/` — Admin dashboard API routes (JWT-protected)
- `lib/withExamSession.ts` — Middleware that validates session token on every student request
- `lib/withAdminAuth.ts` — Middleware that validates JWT on every admin request
- `lib/prisma.ts` — Singleton Prisma client (one per PM2 worker)

**Why PM2 cluster mode?**
Node.js is single-threaded. PM2 cluster mode forks one process per CPU core, each with its own event loop. For a 16-core server:
- 16 independent Node.js processes
- Each handles its own queue of requests
- If one process crashes, others continue
- Load balanced by the OS kernel

---

### 2.5 Async Submission Scoring

When 5000 students submit at the same time (timer expiry), running scoring synchronously would cause:
- 5000 concurrent heavy DB queries
- Connection pool exhaustion
- 30-second timeout errors

**Our solution:**

```
Student submits
    ↓
1. Mark session status = "submitted" (1 fast DB write)
2. Set Redis key "ef:scoring:{sessionId}" (pending marker)
3. Return { submitted: true, scorePending: true } immediately
    ↓ (background, via setImmediate)
4. Load all questions + student responses
5. Calculate score
6. Update session with score, percentage, isPassed
7. Delete Redis pending marker
8. Send WhatsApp result notification
    ↓
Student polls GET /result/{sessionId}
    → Returns { scorePending: true } until step 7 completes
    → Returns full result after scoring done (~200–500ms)
```

This means 5000 concurrent submits = 5000 fast writes (< 5ms each) instead of 5000 heavy scoring queries simultaneously.

---

## 3. Server Requirements

### Minimum (will handle 5000 students)
| Component | Spec |
|---|---|
| CPU | 8 cores |
| RAM | 16 GB |
| Storage | 100 GB NVMe SSD |
| Network | 1 Gbps |
| OS | Ubuntu 22.04 LTS |

### Recommended (comfortable headroom)
| Component | Spec |
|---|---|
| CPU | 16 cores |
| RAM | 32 GB |
| Storage | 200 GB NVMe SSD |
| Network | 1 Gbps |
| OS | Ubuntu 22.04 LTS |

### Resource allocation
| Service | RAM | CPU |
|---|---|---|
| PostgreSQL | 8 GB | 4 cores |
| PgBouncer | 128 MB | 0.5 cores |
| Redis | 2 GB | 1 core |
| Next.js (PM2 × 16) | 8 GB | 8 cores |
| OS overhead | 2 GB | 2 cores |

---

## 4. Install System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version   # v20.x.x
npm --version    # 10.x.x

# Install PostgreSQL 16
sudo apt install -y postgresql-16 postgresql-contrib-16

# Install PgBouncer
sudo apt install -y pgbouncer

# Install Redis 7
sudo apt install -y redis-server

# Install PM2 globally
sudo npm install -g pm2

# Install Git
sudo apt install -y git

# Verify all services
sudo systemctl status postgresql
sudo systemctl status redis-server
```

---

## 5. PostgreSQL Setup & Configuration

### 5.1 Create database and user

```bash
# Switch to postgres superuser
sudo -u postgres psql

-- Inside psql:
CREATE USER examforge_user WITH PASSWORD 'your_strong_password_here';
CREATE DATABASE examforge OWNER examforge_user;
GRANT ALL PRIVILEGES ON DATABASE examforge TO examforge_user;
\q
```

### 5.2 Tune postgresql.conf

Find config file location:
```bash
sudo -u postgres psql -c "SHOW config_file;"
# Usually: /etc/postgresql/16/main/postgresql.conf
```

Edit the file:
```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Apply these settings (adjust based on your RAM):

```ini
# ── Connections ──────────────────────────────────────────────────────────────
# PgBouncer connects to us — keep this low, PgBouncer handles the rest
max_connections = 200

# ── Memory ───────────────────────────────────────────────────────────────────
# 25% of RAM for PostgreSQL's own buffer cache
shared_buffers = 4GB            # 8GB RAM → 2GB, 16GB RAM → 4GB, 32GB RAM → 8GB

# Hint to query planner (not actual allocation) — 75% of RAM
effective_cache_size = 24GB     # 8GB RAM → 6GB, 16GB RAM → 12GB, 32GB RAM → 24GB

# Per-operation sort/join memory
work_mem = 16MB

# For VACUUM, CREATE INDEX, ALTER TABLE
maintenance_work_mem = 1GB

# ── Write Performance ─────────────────────────────────────────────────────────
# Spread checkpoint writes over 90% of checkpoint_timeout
checkpoint_completion_target = 0.9

# WAL (Write-Ahead Log) buffer in memory
wal_buffers = 64MB

# Max WAL before a checkpoint is forced
max_wal_size = 2GB
min_wal_size = 1GB

# ── Query Planning ─────────────────────────────────────────────────────────────
# Tell planner this is an SSD (random I/O is fast)
random_page_cost = 1.1

# ── Logging (keep minimal in production) ─────────────────────────────────────
log_min_duration_statement = 1000   # Log queries slower than 1 second
log_connections = off
log_disconnections = off
```

### 5.3 Configure pg_hba.conf (authentication)

```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Add this line (allows PgBouncer to connect with password from localhost):
```
# TYPE  DATABASE        USER            ADDRESS         METHOD
host    examforge       examforge_user  127.0.0.1/32    scram-sha-256
```

### 5.4 Restart PostgreSQL

```bash
sudo systemctl restart postgresql
sudo systemctl enable postgresql

# Verify connection
psql -h 127.0.0.1 -U examforge_user -d examforge -c "SELECT version();"
```

---

## 6. PgBouncer Setup & Configuration

### 6.1 Configure pgbouncer.ini

```bash
sudo nano /etc/pgbouncer/pgbouncer.ini
```

Replace the entire file with:

```ini
[databases]
examforge = host=127.0.0.1 port=5432 dbname=examforge

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

; ── Pool settings ─────────────────────────────────────────────────────────────
pool_mode = transaction
max_client_conn = 2000
default_pool_size = 100
reserve_pool_size = 20
reserve_pool_timeout = 3

; ── Timeouts ──────────────────────────────────────────────────────────────────
server_idle_timeout = 30
server_lifetime = 600
query_wait_timeout = 10
client_idle_timeout = 0

; ── Compatibility ─────────────────────────────────────────────────────────────
; Prevents startup parameter errors from the pg driver
ignore_startup_parameters = extra_float_digits,options

; ── Logging ───────────────────────────────────────────────────────────────────
log_connections = 0
log_disconnections = 0
log_pooler_errors = 1

; ── Files ─────────────────────────────────────────────────────────────────────
pidfile = /var/run/pgbouncer/pgbouncer.pid
logfile = /var/log/pgbouncer/pgbouncer.log
```

### 6.2 Create the userlist.txt

PgBouncer needs the PostgreSQL password hash to authenticate clients.

Get the hash:
```bash
sudo -u postgres psql -c "
  SELECT pg_catalog.concat(
    '\"', usename, '\" \"', passwd, '\"'
  )
  FROM pg_shadow
  WHERE usename = 'examforge_user';
"
```

Copy the output and put it in the userlist file:
```bash
sudo nano /etc/pgbouncer/userlist.txt
```

It should look like:
```
"examforge_user" "SCRAM-SHA-256$4096:...<hash>..."
```

> **Alternatively**, use MD5 (simpler but less secure). In `pgbouncer.ini` set `auth_type = md5`, then:
> ```bash
> echo -n "your_passwordexamforge_user" | md5sum
> # In userlist.txt:
> "examforge_user" "md5<hash>"
> ```

### 6.3 Fix permissions and start

```bash
sudo mkdir -p /var/log/pgbouncer
sudo chown pgbouncer:pgbouncer /var/log/pgbouncer
sudo chown pgbouncer:pgbouncer /etc/pgbouncer/userlist.txt
sudo chmod 600 /etc/pgbouncer/userlist.txt

sudo systemctl restart pgbouncer
sudo systemctl enable pgbouncer

# Verify PgBouncer works
psql -h 127.0.0.1 -p 6432 -U examforge_user -d examforge -c "SELECT 1;"
```

### 6.4 Verify the connection pool

Connect to PgBouncer admin console to see pool stats:
```bash
psql -h 127.0.0.1 -p 6432 -U pgbouncer pgbouncer
# Inside:
SHOW POOLS;
SHOW STATS;
SHOW CLIENTS;
SHOW SERVERS;
```

---

## 7. Redis Setup & Configuration

### 7.1 Configure redis.conf

```bash
sudo nano /etc/redis/redis.conf
```

Change/add these lines:

```ini
# ── Memory ────────────────────────────────────────────────────────────────────
# Allocate 2GB for Redis — adjust based on your RAM
maxmemory 2gb

# When full, evict least-recently-used keys (fail-open for cache)
maxmemory-policy allkeys-lru

# ── Persistence ───────────────────────────────────────────────────────────────
# RDB snapshot — save to disk periodically
save 900 1      # Save if 1 key changed in last 15 min
save 300 10     # Save if 10 keys changed in last 5 min
save 60 10000   # Save if 10000 keys changed in last 60 sec

# AOF (Append-Only File) — log every write for durability
appendonly yes
appendfsync everysec    # Sync to disk every second (good balance)

# ── Network ───────────────────────────────────────────────────────────────────
# Listen only on localhost — never expose Redis to the internet
bind 127.0.0.1

# Increase TCP backlog for high concurrency
tcp-backlog 511

# ── Performance ───────────────────────────────────────────────────────────────
# Disable slow operations logging below 10ms
slowlog-log-slower-than 10000

# ── Security ──────────────────────────────────────────────────────────────────
# Set a password (optional but recommended)
# requirepass your_redis_password_here
```

### 7.2 Start Redis

```bash
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Test
redis-cli ping    # Should return PONG

# Check memory stats
redis-cli info memory | grep used_memory_human
```

---

## 8. Application Deployment

### 8.1 Clone and install

```bash
# Create app directory
sudo mkdir -p /var/www/examforge
sudo chown $USER:$USER /var/www/examforge

# Clone repo
git clone https://github.com/your-org/examforge.git /var/www/examforge
cd /var/www/examforge

# Install dependencies
npm ci --omit=dev
```

### 8.2 Configure environment

```bash
cp .env .env.production
nano .env.production
```

Fill in all required values (see [Section 11](#11-environment-variables-reference)):

```bash
# Critical: point DATABASE_URL at PgBouncer (port 6432), NOT direct Postgres (5432)
DATABASE_URL=postgresql://examforge_user:your_password@127.0.0.1:6432/examforge

# For migrations only — direct connection to Postgres, bypasses PgBouncer
DIRECT_URL=postgresql://examforge_user:your_password@127.0.0.1:5432/examforge

REDIS_URL=redis://127.0.0.1:6379
REDIS_ENABLED=true

NEXT_PUBLIC_APP_URL=https://your-domain.com

JWT_ACCESS_SECRET=<random 64-char string>
JWT_REFRESH_SECRET=<random 64-char string>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

WHATSAPP_ENABLED=true
SANDESHAI_API_KEY=your_api_key
SANDESHAI_EXAM_INFO_CAMPAIGN_NAME=exam_enrollment
SANDESHAI_EXAM_RESULT_CAMPAIGN_NAME=exam_result
WHATSAPP_DEFAULT_COUNTRY_CODE=91
```

Generate strong secrets:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 8.3 Run database migrations

```bash
# Use DIRECT_URL to bypass PgBouncer for migrations
# (PgBouncer transaction mode doesn't support the session-level commands migrations use)
DATABASE_URL="postgresql://examforge_user:your_password@127.0.0.1:5432/examforge" \
  npx prisma migrate deploy
```

### 8.4 Seed the first admin

```bash
DATABASE_URL="postgresql://examforge_user:your_password@127.0.0.1:5432/examforge" \
  SEED_ADMIN_EMAIL="admin@yourdomain.com" \
  SEED_ADMIN_PASSWORD="StrongPassword@123" \
  SEED_ADMIN_NAME="Super Admin" \
  npm run db:seed
```

### 8.5 Build the application

```bash
# Set NODE_ENV before build
export NODE_ENV=production

# Build (runs prisma generate + next build internally)
npm run build
```

The build output goes to `.next/`. This compiles all pages, optimizes assets, and creates server bundles.

---

## 9. PM2 Process Manager

### 9.1 Why PM2?

Node.js runs on a single CPU core. On a 16-core server, that wastes 15 cores. PM2 cluster mode starts one process per core, all sharing the same port, load-balanced by the OS.

PM2 also:
- Restarts crashed processes automatically
- Starts on server reboot
- Provides logs, metrics, and monitoring

### 9.2 Create PM2 ecosystem config

```bash
nano /var/www/examforge/ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: "examforge",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/examforge",

      // Cluster mode: one process per CPU core
      instances: "max",
      exec_mode: "cluster",

      // Environment
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_file: "/var/www/examforge/.env.production",

      // Memory management
      // Restart if a worker exceeds 1.5GB RAM
      max_memory_restart: "1500M",

      // Logging
      error_file: "/var/log/examforge/error.log",
      out_file:   "/var/log/examforge/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Graceful restart: wait for in-flight requests to finish
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
```

### 9.3 Start and configure auto-start

```bash
sudo mkdir -p /var/log/examforge
sudo chown $USER:$USER /var/log/examforge

# Start the app
pm2 start /var/www/examforge/ecosystem.config.js

# Save PM2 process list so it survives reboots
pm2 save

# Configure PM2 to start on system boot
pm2 startup
# ↑ This prints a command — copy and run it as root, e.g.:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### 9.4 Useful PM2 commands

```bash
pm2 list                    # Show all running processes + status
pm2 monit                   # Live dashboard with CPU/RAM per worker
pm2 logs examforge          # Stream logs
pm2 logs examforge --lines 100  # Last 100 lines
pm2 reload examforge        # Zero-downtime restart (for deploys)
pm2 restart examforge       # Hard restart (loses in-flight requests)
pm2 stop examforge          # Stop
pm2 delete examforge        # Remove from PM2
```

---

## 10. Nginx Reverse Proxy

### 10.1 Install and configure

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

```bash
sudo nano /etc/nginx/sites-available/examforge
```

```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL (managed by Certbot)
    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    # ── Security Headers ────────────────────────────────────────────────────
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ── Timeouts for exam session (up to 2 hours) ───────────────────────────
    proxy_read_timeout    7200;
    proxy_connect_timeout 60;
    proxy_send_timeout    7200;

    # ── Buffer settings for high concurrency ───────────────────────────────
    proxy_buffering on;
    proxy_buffer_size 8k;
    proxy_buffers 16 8k;

    # ── Main proxy to Next.js ───────────────────────────────────────────────
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Required for WebSocket support (if used)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # Pass real client IP to the app (used for rate limiting)
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
    }

    # ── Static assets — serve directly with long cache ─────────────────────
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/examforge /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Reload Nginx
sudo systemctl reload nginx
sudo systemctl enable nginx
```

---

## 11. Environment Variables Reference

| Variable | Required | Example | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@127.0.0.1:6432/examforge` | **Must point to PgBouncer (port 6432)** |
| `DIRECT_URL` | ⚠️ migrations | `postgresql://user:pass@127.0.0.1:5432/examforge` | Direct Postgres, used only for `prisma migrate deploy` |
| `REDIS_URL` | ✅ | `redis://127.0.0.1:6379` | Redis connection string |
| `REDIS_ENABLED` | ✅ | `true` | Set `false` to disable caching (not recommended) |
| `NEXT_PUBLIC_APP_URL` | ✅ | `https://your-domain.com` | Used in WhatsApp message links |
| `JWT_ACCESS_SECRET` | ✅ | 64-char random string | Signs admin access tokens (15-min expiry) |
| `JWT_REFRESH_SECRET` | ✅ | 64-char random string | Signs admin refresh tokens (7-day expiry) |
| `JWT_ACCESS_EXPIRES_IN` | ✅ | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | ✅ | `7d` | Refresh token lifetime |
| `WHATSAPP_ENABLED` | ✅ | `true` | Enable WhatsApp notifications via Sandeshai |
| `SANDESHAI_API_KEY` | ✅ | UUID | Your Sandeshai API key |
| `SANDESHAI_EXAM_INFO_CAMPAIGN_NAME` | ✅ | `exam_enrollment` | Campaign name for registration message |
| `SANDESHAI_EXAM_RESULT_CAMPAIGN_NAME` | ✅ | `exam_result` | Campaign name for result message |
| `WHATSAPP_DEFAULT_COUNTRY_CODE` | ✅ | `91` | Prepended to phone numbers without country code |
| `SEED_ADMIN_EMAIL` | seed only | `admin@example.com` | First super-admin email |
| `SEED_ADMIN_PASSWORD` | seed only | `StrongPass@123` | First super-admin password |
| `SEED_ADMIN_NAME` | seed only | `Super Admin` | First super-admin display name |
| `NODE_ENV` | ✅ | `production` | Disables dev tools, enables optimizations |

---

## 12. Load Testing with k6 + Docker

### 12.1 What is k6?

k6 is a load testing tool written in Go. It runs JavaScript test scripts and simulates thousands of virtual users (VUs) making concurrent HTTP requests. Each VU is a goroutine — extremely lightweight compared to real browsers.

**Key concepts:**
- **VU (Virtual User):** A concurrent user executing the test script
- **Iteration:** One complete run of the test function (register → take exam → submit)
- **Scenario:** Defines how many VUs run and for how long
- **Threshold:** A pass/fail condition (e.g. `p(95) < 2000ms`)

### 12.2 Our test scenarios

| Scenario | VUs | Duration | Purpose |
|---|---|---|---|
| `smoke` | 5 | 2 min | Verify the full flow works end-to-end |
| `load` | 0→500→0 | ~25 min | Baseline capacity, find bottlenecks |
| `stress` | 0→5000→0 | ~2 hours | Full exam simulation |
| `spike` | instant 5000 | 6 min | Worst case — all students submit simultaneously |

### 12.3 What the k6 script tests

Each virtual user simulates a complete student journey:

```
1. POST /register          → Enroll with unique email, get examPassword
2. POST /verify-access     → Start session, get sessionToken
3. GET  /questions         → Load all 50 questions
4. POST /response × 50    → Answer each question (2–8s think time between)
5. POST /submit            → Submit exam
6. GET  /result (poll)     → Poll until score is ready
```

### 12.4 Running load tests

**Step 1: Start infrastructure**
```bash
# Start Postgres, PgBouncer, Redis via Docker
docker compose -f docker/load-test/docker-compose.yml up -d postgres pgbouncer redis

# Wait for Postgres to be ready
until docker exec ef_postgres pg_isready -U examforge_user -d examforge; do sleep 1; done
```

**Step 2: Migrate and seed**
```bash
# Run migrations (direct Postgres connection for migrations)
DATABASE_URL="postgresql://examforge_user:examforge_pass@127.0.0.1:5432/examforge" \
  npx prisma migrate deploy

# Seed a test exam with 50 questions
DATABASE_URL="postgresql://examforge_user:examforge_pass@127.0.0.1:5434/examforge" \
  EXAM_SLUG="load-test-exam" \
  WHATSAPP_ENABLED="false" \
  npx tsx tests/k6/seed.ts
```

**Step 3: Start the app pointing at Docker DB**

Temporarily update `DATABASE_URL` in your `.env.local` (or `.env`) to:
```
DATABASE_URL=postgresql://examforge_user:examforge_pass@127.0.0.1:6432/examforge
REDIS_URL=redis://127.0.0.1:6379
WHATSAPP_ENABLED=false
```
Then start the app:
```bash
npm run dev   # For testing
# OR
npm run build && npm start  # For production-like testing
```

**Step 4: Run k6 via Docker**
```bash
# Smoke test (always start here)
docker run --rm --network host \
  -v "$(pwd)/tests/k6:/scripts" \
  -e BASE_URL=http://localhost:3000 \
  -e EXAM_SLUG=load-test-exam \
  -e SCENARIO=smoke \
  grafana/k6 run /scripts/exam-flow.js

# Load test (500 VUs)
docker run --rm --network host \
  -v "$(pwd)/tests/k6:/scripts" \
  -e BASE_URL=http://localhost:3000 \
  -e EXAM_SLUG=load-test-exam \
  -e SCENARIO=load \
  grafana/k6 run /scripts/exam-flow.js

# Or use npm scripts
npm run k6:smoke
npm run k6:load
npm run k6:stress
npm run k6:spike
```

### 12.5 Reading k6 output

```
http_req_duration......: avg=380ms min=31ms med=129ms max=3.6s p(90)=1.07s p(95)=3.03s
```

| Metric | What it means | Target |
|---|---|---|
| `avg` | Average response time | < 500ms |
| `med` | 50% of requests faster than this | < 200ms |
| `p(90)` | 90% of requests faster than this | < 1000ms |
| `p(95)` | 95% of requests faster than this | < 2000ms |
| `p(99)` | 99% of requests faster than this | < 5000ms |
| `http_req_failed` | Percentage of failed HTTP requests | < 2% |

```
checks_succeeded: 100.00% 170 out of 170
```
All custom checks (register returns token, verify-access 200, etc.) passed.

### 12.6 Common issues during load testing

**Rate limit 429 errors on re-runs:**
```bash
# Clear Redis rate limit keys before re-running
docker exec ef_redis redis-cli KEYS "ef:rate:*" | xargs docker exec -i ef_redis redis-cli DEL
```

**"No script iterations fully finished":**
This is expected for smoke/load scenarios because one full exam takes 100–400 seconds (50 questions × 2–8s think time). The warning means VUs were mid-exam when time ran out. Not an error.

**PgBouncer connection errors:**
```bash
docker logs ef_pgbouncer | grep -i error
# Check pool stats:
psql -h 127.0.0.1 -p 6432 -U pgbouncer pgbouncer -c "SHOW POOLS;"
```

---

## 13. Running Tests

### 13.1 Unit tests (no database needed)

Unit tests test isolated library functions with mocked dependencies.

```bash
npm test                    # Run once
npm run test:watch          # Watch mode (re-runs on file change)
npm run test:coverage       # With coverage report
```

**What's tested:**
- `lib/whatsapp-templates.ts` — `buildExamRegistrationTemplate()` variable mapping, formatting
- `lib/rateLimit.ts` — In-memory fallback allow/block/reset behavior, `getClientIp` parsing

### 13.2 Integration tests (requires Postgres + PgBouncer + Redis)

Integration tests call the actual Next.js route handlers against a real test database.

**Setup:**

```bash
# Start infra (can use the same Docker setup as load testing)
docker compose -f docker/load-test/docker-compose.yml up -d postgres pgbouncer redis

# Create a separate test database
docker exec ef_postgres psql -U examforge_user -c "CREATE DATABASE examforge_test;"

# Set test DB URL in .env.test.local
echo "DATABASE_URL_TEST=postgresql://examforge_user:examforge_pass@127.0.0.1:6432/examforge_test" > .env.test.local
echo "REDIS_URL_TEST=redis://127.0.0.1:6379/1" >> .env.test.local

# Run integration tests
npm run test:integration
```

**What's tested:**
- `exam-register.test.ts` — Registration, idempotency, validation, DB record creation
- `exam-submit.test.ts` — Submit, double-submit prevention, async scoring, result polling

### 13.3 Run all tests

```bash
npm run test:all
```

---

## 14. Monitoring & Health Checks

### 14.1 Check service status

```bash
# All at once
sudo systemctl status postgresql pgbouncer redis-server nginx

# App workers
pm2 list
pm2 monit   # Live CPU/RAM per worker
```

### 14.2 PostgreSQL monitoring

```bash
# Active connections
psql -h 127.0.0.1 -p 5432 -U examforge_user -d examforge -c "
  SELECT count(*), state FROM pg_stat_activity GROUP BY state;
"

# Slow queries (check log)
sudo tail -f /var/log/postgresql/postgresql-16-main.log

# Database size
psql -h 127.0.0.1 -p 5432 -U examforge_user -d examforge -c "
  SELECT pg_size_pretty(pg_database_size('examforge'));
"
```

### 14.3 PgBouncer monitoring

```bash
psql -h 127.0.0.1 -p 6432 -U pgbouncer pgbouncer

# Inside pgbouncer console:
SHOW POOLS;     # Active/idle/waiting connections per pool
SHOW STATS;     # Requests per second, avg query time
SHOW CLIENTS;   # Current client connections
SHOW SERVERS;   # Current connections to PostgreSQL
```

**Key things to watch:**
- `cl_waiting` in `SHOW POOLS` — clients waiting for a connection. Should be 0 or low.
- If `cl_waiting` is high, increase `default_pool_size` in `pgbouncer.ini`

### 14.4 Redis monitoring

```bash
redis-cli info | grep -E "connected_clients|used_memory_human|keyspace_hits|keyspace_misses"

# Cache hit rate (higher = better)
redis-cli info stats | grep -E "keyspace_hits|keyspace_misses"
# hit_rate = hits / (hits + misses) × 100
# Target: > 90% during exam
```

### 14.5 Application health endpoint

```bash
curl https://your-domain.com/api/health
# Or check Next.js directly
curl http://localhost:3000
```

### 14.6 Log files

| Log | Location | Command |
|---|---|---|
| App output | `/var/log/examforge/out.log` | `pm2 logs examforge` |
| App errors | `/var/log/examforge/error.log` | `pm2 logs examforge --err` |
| PostgreSQL | `/var/log/postgresql/postgresql-16-main.log` | `sudo tail -f ...` |
| PgBouncer | `/var/log/pgbouncer/pgbouncer.log` | `sudo tail -f ...` |
| Nginx access | `/var/log/nginx/access.log` | `sudo tail -f ...` |
| Nginx errors | `/var/log/nginx/error.log` | `sudo tail -f ...` |

---

## 15. Troubleshooting

### "Too many connections" from PostgreSQL

**Symptom:** `FATAL: sorry, too many clients already`

**Cause:** App is bypassing PgBouncer and connecting directly to Postgres, or `default_pool_size` is too high.

**Fix:**
```bash
# Check who is connecting
psql -h 127.0.0.1 -U examforge_user -d examforge -c "
  SELECT application_name, count(*) FROM pg_stat_activity GROUP BY application_name;
"
# Verify DATABASE_URL points to port 6432 (PgBouncer), not 5432 (Postgres)
grep DATABASE_URL .env.production
```

---

### PgBouncer auth failure

**Symptom:** `FATAL: password authentication failed for user "examforge_user"` in PgBouncer logs

**Cause:** Hash in `userlist.txt` doesn't match the database password.

**Fix:**
```bash
# Regenerate the hash
sudo -u postgres psql -c "
  SELECT pg_catalog.concat('\"', usename, '\" \"', passwd, '\"')
  FROM pg_shadow WHERE usename = 'examforge_user';
" | sudo tee /etc/pgbouncer/userlist.txt
sudo systemctl restart pgbouncer
```

---

### Scoring fails silently

**Symptom:** Result page shows `scorePending: true` forever.

**Cause:** Background scoring threw an error (check app logs).

**Fix:**
```bash
pm2 logs examforge | grep "Background scoring failed"
# If Redis is down, the pending marker never gets deleted
redis-cli del "ef:scoring:<sessionId>"
```

---

### Redis rate limit blocks k6 tests

**Symptom:** k6 gets 429 immediately on re-run.

**Fix:**
```bash
redis-cli KEYS "ef:rate:*" | xargs redis-cli DEL
# OR (Docker)
docker exec ef_redis redis-cli KEYS "ef:rate:*" | xargs docker exec -i ef_redis redis-cli DEL
```

---

### PM2 workers keep restarting

**Symptom:** `pm2 list` shows workers in `errored` or high restart count.

**Fix:**
```bash
pm2 logs examforge --err --lines 50
# Common causes:
# - DATABASE_URL wrong
# - Redis not reachable
# - Missing environment variable
# - Out of memory (increase max_memory_restart or add more RAM)
```

---

### Slow first request after deploy

**Symptom:** First request after deploy takes 3–5 seconds.

**Cause:** Node.js JIT compilation + cold Prisma connection + Redis cache miss.

**Fix:** Warm up the server after deploy:
```bash
# Hit the main exam endpoint a few times to warm up caches
curl -s https://your-domain.com/api/exam/your-exam-slug > /dev/null
curl -s https://your-domain.com/api/exam/your-exam-slug > /dev/null
```

---

## 16. Security Hardening

### 16.1 Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change 22 to your SSH port if different)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS (for Nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct access to Postgres, PgBouncer, Redis from outside
# (They only need to be reachable from localhost)
# DO NOT open ports 5432, 6432, 6379

sudo ufw enable
sudo ufw status
```

### 16.2 PostgreSQL security

```bash
# Edit pg_hba.conf — only allow local connections
# Remove any lines that allow external IP access to PostgreSQL
# PgBouncer handles external access, Postgres should be localhost-only
```

### 16.3 Redis security

```bash
# In /etc/redis/redis.conf:
bind 127.0.0.1       # Only localhost
# requirepass your_strong_redis_password
```

### 16.4 Secrets rotation

- Rotate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` if they are compromised (invalidates all admin sessions)
- Rotate `SANDESHAI_API_KEY` from the Sandeshai dashboard

### 16.5 Deployment checklist before exam day

```
□ DATABASE_URL points to PgBouncer port 6432
□ DIRECT_URL points to Postgres port 5432 (for migrations)
□ All JWT secrets are strong (64+ chars, random)
□ WHATSAPP_ENABLED=true and SANDESHAI_API_KEY is set
□ Nginx SSL cert is valid: sudo certbot renew --dry-run
□ PM2 is running and configured to start on reboot: pm2 list
□ Exam is published in the admin dashboard
□ Access rule is set correctly (public_link or specific_emails)
□ Run smoke test 1 hour before exam: npm run k6:smoke
□ Redis is reachable: redis-cli ping
□ PgBouncer pool is healthy: psql -p 6432 ... -c "SHOW POOLS;"
```
