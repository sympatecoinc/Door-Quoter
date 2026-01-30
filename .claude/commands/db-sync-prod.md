# Database Sync - Production Only

Synchronize database schema from local dev to the production Cloud SQL database.

## Overview

This command will:
1. Verify gcloud authentication
2. Start Cloud SQL proxy for production
3. Check migration status
4. **Detect and FIX schema drift using `prisma migrate diff`**
5. Apply pending migrations
6. Verify sync success

**Target: Zero user input after initial start**

---

## STEP 1: Pre-flight Checks

### 1.1 Announce Sync Session

```
Syncing PRODUCTION database...

Target: door-app-db (Cloud SQL)
Port: 5433

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
ls /home/kylepalmer/Door-Quoter/prisma/migrations/ | grep -v "migration_lock" | tail -1
```

**Expected project:** `linea-door-quoter`

If not authenticated or wrong project, fix before continuing.

---

## STEP 2: Setup Cloud SQL Proxy

### 2.1 Kill Existing Production Proxy

```bash
pkill -f "cloud_sql_proxy.*door-app-db" || echo "No existing proxy"
sleep 2
```

### 2.2 Start Production Proxy (Port 5433)

```bash
# v2 syntax (cloud-sql-proxy 2.x) - Use credentials file for reliable auth
~/cloud_sql_proxy linea-door-quoter:us-central1:door-app-db --port 5433 --credentials-file=/home/kylepalmer/Door-Quoter/github-actions-key.json > /tmp/prod-proxy.log 2>&1 &
sleep 3
```

**Note:** The `--credentials-file` flag is required because Application Default Credentials (ADC) may not have the `cloudsql.instances.get` permission. The service account key file provides consistent authentication.

### 2.3 Verify Proxy Running

```bash
pgrep -a cloud_sql_proxy | grep door-app-db
ss -tlnp | grep ':5433'
```

If proxy failed, check `/tmp/prod-proxy.log` and report error.

---

## STEP 3: Check Migration Status

### 3.1 Connection String

```
PRODUCTION: postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable
```

### 3.2 Check Status

```bash
cd /home/kylepalmer/Door-Quoter && DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate status
```

**If up to date:** Continue to Step 3.3 (drift detection)
**If pending migrations:** Continue to Step 4

---

### 3.3 Schema Drift Detection & Auto-Fix (CRITICAL)

**IMPORTANT: Even if migrations show "up to date", schema drift can occur when schema.prisma is modified without creating migrations.**

**This step automatically detects AND fixes drift - no manual intervention required.**

#### Step 1: Detect drift and save to file

```bash
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > /tmp/schema_drift.sql 2>&1
cat /tmp/schema_drift.sql
```

#### Step 2: Check if drift exists and auto-fix

**If output is `-- This is an empty migration.`** → No drift, skip to Step 4.

**If output contains SQL statements** → Execute the following to auto-fix:

```bash
# Check if there's actual drift (not just empty migration comment)
if grep -q "ALTER TABLE\|CREATE TABLE\|CREATE INDEX\|DROP" /tmp/schema_drift.sql; then
  echo "Drift detected - applying fix automatically..."
  DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma db execute --url "postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" --file /tmp/schema_drift.sql
  echo "Drift fix applied."
else
  echo "No drift detected - schema is in sync."
fi
```

#### Step 3: Verify drift is fixed

```bash
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

**Expected output:** `-- This is an empty migration.`

**If drift still exists after auto-fix, STOP and report the error. Do not proceed.**

---

## STEP 4: Apply Migrations

### 4.1 Deploy Migrations

```bash
cd /home/kylepalmer/Door-Quoter && DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate deploy
```

### 4.2 Handle Baselining (If Needed)

If error `P3005: The database schema is not empty`:

```bash
# Get first migration name
ls /home/kylepalmer/Door-Quoter/prisma/migrations/ | grep -v "migration_lock" | head -1

# Mark as applied
cd /home/kylepalmer/Door-Quoter && DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate resolve --applied [MIGRATION_NAME]

# Re-run deploy
cd /home/kylepalmer/Door-Quoter && DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate deploy
```

---

## STEP 5: Verify Sync

### 5.1 Check Final Status

```bash
cd /home/kylepalmer/Door-Quoter && DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate status
```

**Expected:** `Database schema is up to date!`

### 5.2 Verify No Schema Drift

**CRITICAL: Always run this check even if migrations are up to date!**

```bash
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

**Expected output:** `-- This is an empty migration.`

**If any SQL statements appear, go back to Step 3.4 and fix the drift!**

### 5.3 Test Connection

```bash
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" node << 'SCRIPT'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
Promise.all([prisma.product.count(), prisma.user.count(), prisma.masterPart.count()])
.then(([products, users, parts]) => {
  console.log('Production Counts - Products:', products, '| Users:', users, '| MasterParts:', parts);
  prisma.$disconnect();
}).catch(e => console.error('Error:', e.message));
SCRIPT
```

---

## STEP 6: Cleanup & Final Report

### 6.1 Stop Proxy

```bash
pkill -f "cloud_sql_proxy.*door-app-db"
```

### 6.2 Report

```markdown
## Production Sync Complete

**Date:** [YYYY-MM-DD HH:MM]
**Environment:** Production (door-app-db)

| Check | Status |
|-------|--------|
| Migrations | [X] applied |
| Schema Drift | None (verified with prisma migrate diff) |
| Connection | Verified |
| Products | [count] |
| Proxy | Stopped |
```

---

## Quick Reference

```bash
# Start proxy manually (with credentials file)
~/cloud_sql_proxy linea-door-quoter:us-central1:door-app-db --port 5433 --credentials-file=/home/kylepalmer/Door-Quoter/github-actions-key.json &

# Check status
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate status

# Check for schema drift (MOST IMPORTANT COMMAND)
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script

# Apply migrations
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate deploy

# Stop proxy
pkill -f "cloud_sql_proxy.*door-app-db"
```

### Production Credentials

| Field | Value |
|-------|-------|
| Host | 127.0.0.1 (via proxy) |
| Port | 5433 |
| User | postgres |
| Database | door_quoter |
| Password | SimplePass123 |
| Instance | linea-door-quoter:us-central1:door-app-db |
| Credentials File | `/home/kylepalmer/Door-Quoter/github-actions-key.json` |

---

## Why Schema Drift Happens

Schema drift occurs when:
1. `schema.prisma` is modified but no migration is created
2. A migration is created locally but not deployed to production
3. Manual changes are made directly to the database

**The `prisma migrate diff` command compares:**
- `--from-schema-datasource`: The actual database (reads connection from schema.prisma)
- `--to-schema-datamodel`: The desired schema (from schema.prisma file)

This is more reliable than hardcoded column counts because it automatically detects ALL differences.

---

## Troubleshooting

### Proxy Connection Fails with "NOT_AUTHORIZED" Error

If you see an error like:
```
googleapi: Error 403: boss::NOT_AUTHORIZED: Not authorized to access resource.
Possibly missing permission cloudsql.instances.get on resource instances/door-app-db., forbidden
```

**Cause:** Application Default Credentials (ADC) may not have the `cloudsql.instances.get` permission, even if your gcloud user has `roles/owner`.

**Solution:** Use the service account credentials file:
```bash
~/cloud_sql_proxy linea-door-quoter:us-central1:door-app-db --port 5433 \
  --credentials-file=/home/kylepalmer/Door-Quoter/github-actions-key.json &
```

### Proxy Log Location

Check `/tmp/prod-proxy.log` for detailed error messages if the proxy fails to start or connect.

---

*Last updated: 2026-01-28*

*Syncs production database only. Use /db-sync-stage for staging.*
