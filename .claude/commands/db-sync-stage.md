# Database Sync - Staging Only

Synchronize database schema from local dev to the staging Cloud SQL database.

## Overview

This command will:
1. Verify gcloud authentication
2. Start Cloud SQL proxy for staging
3. Check migration status
4. Apply pending migrations
5. Verify sync success

**Target: Zero user input after initial start**

---

## STEP 1: Pre-flight Checks

### 1.1 Announce Sync Session

```
Syncing STAGING database...

Target: door-app-staging (Cloud SQL)
Port: 5434

Checking prerequisites...
```

### 1.2 Verify Prerequisites

Run these checks in parallel:

```bash
# Check gcloud auth
~/google-cloud-sdk/bin/gcloud auth list --filter=status:ACTIVE --format="value(account)"

# Check project
~/google-cloud-sdk/bin/gcloud config get-value project

# Check Prisma schema validity
cd /home/kylepalmer/Door-Quoter && npx prisma validate

# Get latest migration
ls /home/kylepalmer/Door-Quoter/prisma/migrations/ | tail -1
```

**Expected project:** `door-quoter`

If not authenticated or wrong project, fix before continuing.

---

## STEP 2: Setup Cloud SQL Proxy

### 2.1 Kill Existing Staging Proxy

```bash
pkill -f "cloud_sql_proxy.*door-app-staging" || echo "No existing proxy"
sleep 2
```

### 2.2 Start Staging Proxy (Port 5434)

```bash
# v2 syntax (cloud-sql-proxy 2.x)
~/cloud_sql_proxy door-quoter:us-central1:door-app-staging --port 5434 > /tmp/staging-proxy.log 2>&1 &
sleep 3
```

### 2.3 Verify Proxy Running

```bash
pgrep -a cloud_sql_proxy | grep staging
ss -tlnp | grep ':5434'
```

If proxy failed, check `/tmp/staging-proxy.log` and report error.

---

## STEP 3: Check Migration Status

### 3.1 Connection String

```
STAGING: postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable
```

### 3.2 Check Status

```bash
cd /home/kylepalmer/Door-Quoter && DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" npx prisma migrate status
```

**If up to date:** Skip to Step 5 (verification)
**If pending migrations:** Continue to Step 4

---

## STEP 4: Apply Migrations

### 4.1 Deploy Migrations

```bash
cd /home/kylepalmer/Door-Quoter && DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" npx prisma migrate deploy
```

### 4.2 Handle Baselining (If Needed)

If error `P3005: The database schema is not empty`:

```bash
# Get first migration name
ls /home/kylepalmer/Door-Quoter/prisma/migrations/ | head -1

# Mark as applied
cd /home/kylepalmer/Door-Quoter && DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" npx prisma migrate resolve --applied [MIGRATION_NAME]

# Re-run deploy
cd /home/kylepalmer/Door-Quoter && DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" npx prisma migrate deploy
```

---

## STEP 5: Verify Sync

### 5.1 Check Final Status

```bash
cd /home/kylepalmer/Door-Quoter && DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" npx prisma migrate status
```

**Expected:** `Database schema is up to date!`

### 5.2 Test Connection

```bash
DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.product.count().then(c => { console.log('Staging Products:', c); prisma.\$disconnect(); }).catch(e => console.error('Error:', e.message));
"
```

---

## STEP 6: Cleanup & Final Report

### 6.1 Stop Proxy

```bash
pkill -f "cloud_sql_proxy.*door-app-staging"
```

### 6.2 Report

```markdown
## Staging Sync Complete

**Date:** [YYYY-MM-DD HH:MM]
**Environment:** Staging (door-app-staging)

| Check | Status |
|-------|--------|
| Migrations | [X] applied |
| Schema | Up to date |
| Connection | Verified |
| Products | [count] |
| Proxy | Stopped |
```

---

## Quick Reference

```bash
# Start proxy manually
~/cloud_sql_proxy door-quoter:us-central1:door-app-staging --port 5434 &

# Check status
DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" npx prisma migrate status

# Apply migrations
DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" npx prisma migrate deploy

# Stop proxy
pkill -f "cloud_sql_proxy.*staging"
```

### Staging Credentials

| Field | Value |
|-------|-------|
| Host | 127.0.0.1 (via proxy) |
| Port | 5434 |
| User | postgres |
| Database | postgres |
| Password | StagingDB123 |
| Instance | door-quoter:us-central1:door-app-staging |

---

*Syncs staging database only. Use /db-sync-prod for production.*
