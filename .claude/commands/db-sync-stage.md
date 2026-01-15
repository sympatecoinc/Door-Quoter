# Database Sync - Staging Only

Synchronize database schema from local dev to the staging Cloud SQL database.

## Overview

This command will:
1. Verify gcloud authentication
2. Start Cloud SQL proxy for staging
3. Check migration status
4. **Detect and FIX schema drift using `prisma migrate diff`**
5. Apply pending migrations
6. Verify sync success

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
ls /home/kylepalmer/Door-Quoter/prisma/migrations/ | grep -v "migration_lock" | tail -1
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

**If up to date:** Continue to Step 3.3 (drift detection)
**If pending migrations:** Continue to Step 4

---

### 3.3 Schema Drift Detection (CRITICAL)

**IMPORTANT: Even if migrations show "up to date", schema drift can occur when schema.prisma is modified without creating migrations.**

**Use Prisma's built-in drift detection - this is the most reliable method:**

```bash
DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

**Interpreting results:**
- If output is `-- This is an empty migration.` → **No drift, schema is in sync!**
- If output contains SQL statements → **Drift detected, must fix!**

**If drift detected, the output will show exactly what SQL needs to run.** For example:
```sql
-- AlterTable
ALTER TABLE "Products" ADD COLUMN "productCategory" "ProductCategory" NOT NULL DEFAULT 'Both';
ALTER TABLE "Products" ADD COLUMN "defaultWidth" DOUBLE PRECISION;
ALTER TABLE "ProductSubOptions" ADD COLUMN "isMandatory" BOOLEAN NOT NULL DEFAULT false;
```

---

### 3.4 Fix Schema Drift (If Detected)

**If drift was detected in Step 3.3, you MUST fix it before continuing.**

#### Option A: Direct SQL Execution (Recommended for simple drift)

Execute the SQL from the diff output directly using a heredoc:

```bash
DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" node << 'SCRIPT'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  // Copy the SQL statements from the migrate diff output here
  // Use IF NOT EXISTS to make idempotent

  // Example:
  // await prisma.$executeRawUnsafe(`ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS "newColumn" TEXT`);

  console.log('Schema drift fixed');
  await prisma.$disconnect();
}

fix().catch(e => { console.error('Error:', e.message); prisma.$disconnect(); });
SCRIPT
```

#### Option B: Create Migration File (Recommended for tracking)

1. Create migration folder:
```bash
mkdir -p prisma/migrations/$(date +%Y%m%d)_fix_schema_drift
```

2. Create `migration.sql` with the SQL from the diff output

3. Apply to staging and mark as applied:
```bash
# Apply the SQL directly first
DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" node << 'SCRIPT'
// Execute the SQL statements here
SCRIPT

# Then mark migration as applied
DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" npx prisma migrate resolve --applied [MIGRATION_FOLDER_NAME]
```

#### After fixing drift, re-run Step 3.3 to verify:

```bash
DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

**Expected output:** `-- This is an empty migration.`

**DO NOT PROCEED until drift is fixed!**

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
ls /home/kylepalmer/Door-Quoter/prisma/migrations/ | grep -v "migration_lock" | head -1

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

### 5.2 Verify No Schema Drift

**CRITICAL: Always run this check even if migrations are up to date!**

```bash
DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

**Expected output:** `-- This is an empty migration.`

**If any SQL statements appear, go back to Step 3.4 and fix the drift!**

### 5.3 Test Connection

```bash
DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" node << 'SCRIPT'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
Promise.all([prisma.product.count(), prisma.user.count(), prisma.masterPart.count()])
.then(([products, users, parts]) => {
  console.log('Staging Counts - Products:', products, '| Users:', users, '| MasterParts:', parts);
  prisma.$disconnect();
}).catch(e => console.error('Error:', e.message));
SCRIPT
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
| Schema Drift | None (verified with prisma migrate diff) |
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

# Check for schema drift (MOST IMPORTANT COMMAND)
DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable" npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script

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

## Why Schema Drift Happens

Schema drift occurs when:
1. `schema.prisma` is modified but no migration is created
2. A migration is created locally but not deployed to staging
3. Manual changes are made directly to the database

**The `prisma migrate diff` command compares:**
- `--from-schema-datasource`: The actual database (reads connection from schema.prisma)
- `--to-schema-datamodel`: The desired schema (from schema.prisma file)

This is more reliable than hardcoded column counts because it automatically detects ALL differences.

---

*Last updated: 2026-01-15*

*Syncs staging database only. Use /db-sync-prod for production.*
