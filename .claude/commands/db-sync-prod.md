# Database Sync - Production Only

Synchronize database schema from local dev to the production Cloud SQL database.

## Overview

This command will:
1. Verify gcloud authentication
2. Start Cloud SQL proxy for production
3. Check migration status
4. **NEW: Detect schema drift (missing tables/columns)**
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
ls /home/kylepalmer/Door-Quoter/prisma/migrations/ | tail -1
```

**Expected project:** `door-quoter`

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
# v2 syntax (cloud-sql-proxy 2.x)
~/cloud_sql_proxy door-quoter:us-central1:door-app-db --port 5433 > /tmp/prod-proxy.log 2>&1 &
sleep 3
```

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

### 3.3 Schema Drift Detection (CRITICAL)

**Even if migrations show "up to date", schema drift can occur when schema.prisma is modified without creating migrations.**

Run this comprehensive drift detection:

```bash
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" node -e "
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

// Expected tables from schema.prisma (update when schema changes)
const expectedTables = [
  'Projects', 'ProjectStatusHistory', 'Openings', 'Panels', 'Products',
  'SubOptionCategories', 'IndividualOptions', 'ProductSubOptions', 'BOMs',
  'ProductBOMs', 'ComponentInstances', 'MasterParts', 'StockLengthRules',
  'PricingRules', 'Customers', 'Contacts', 'Leads', 'Activities',
  'CustomerFiles', 'QuoteAttachments', 'ProjectContacts', 'ProjectNotes',
  'ComponentLibrary', 'ProductPlanViews', 'GlassTypes', 'GlassTypeParts',
  'PricingModes', 'Profiles', 'Users', 'Sessions', 'QuoteDocuments',
  'ProductQuoteDocuments', 'ExtrusionFinishPricing', 'ExtrusionVariants',
  'Vendors', 'VendorContacts', 'QuickBooksTokens', 'GlobalSettings'
];

// Expected column counts per table (update when schema changes)
const expectedColumnCounts = {
  'MasterParts': 26,  // includes customPricePerLb, inventory fields, binLocationId
  'Openings': 21,
  'ProductBOMs': 22,
  'Users': 11,
  'Profiles': 7,
  'ExtrusionVariants': 14,  // includes inventory fields, binLocationId
  'GlobalSettings': 8
};

async function checkDrift() {
  const dbTables = await prisma.\$queryRaw\`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name != '_prisma_migrations'
  \`;
  const dbTableNames = dbTables.map(t => t.table_name);

  const missingTables = expectedTables.filter(t => !dbTableNames.includes(t));

  const colCounts = await prisma.\$queryRaw\`
    SELECT table_name, COUNT(*) as col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    GROUP BY table_name
  \`;
  const colCountMap = Object.fromEntries(colCounts.map(c => [c.table_name, Number(c.col_count)]));

  const columnDrift = [];
  for (const [table, expected] of Object.entries(expectedColumnCounts)) {
    const actual = colCountMap[table] || 0;
    if (actual !== expected) {
      columnDrift.push({ table, expected, actual, diff: expected - actual });
    }
  }

  console.log('=== Schema Drift Detection ===');
  console.log('Tables in DB:', dbTableNames.length);
  console.log('Expected tables:', expectedTables.length);

  if (missingTables.length > 0) {
    console.log('\\n*** MISSING TABLES ***');
    missingTables.forEach(t => console.log('  -', t));
  }

  if (columnDrift.length > 0) {
    console.log('\\n*** COLUMN COUNT MISMATCHES ***');
    columnDrift.forEach(d => console.log(\`  - \${d.table}: expected \${d.expected}, got \${d.actual} (missing \${d.diff})\`));
  }

  if (missingTables.length === 0 && columnDrift.length === 0) {
    console.log('\\n*** NO DRIFT DETECTED - Schema is in sync! ***');
  } else {
    console.log('\\n*** DRIFT DETECTED - Run prisma migrate deploy or create new migration ***');
  }

  await prisma.\$disconnect();
}

checkDrift().catch(e => { console.error('Error:', e.message); prisma.\$disconnect(); });
"
```

**If drift detected:**
- Missing tables/columns mean schema.prisma was modified without a migration
- Create a new migration: `npx prisma migrate dev --name fix_schema_drift`
- Or manually create SQL migration file (see Step 4.3)

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
ls /home/kylepalmer/Door-Quoter/prisma/migrations/ | head -1

# Mark as applied
cd /home/kylepalmer/Door-Quoter && DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate resolve --applied [MIGRATION_NAME]

# Re-run deploy
cd /home/kylepalmer/Door-Quoter && DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate deploy
```

### 4.3 Create Migration for Schema Drift

If drift was detected and no pending migrations exist, create a new migration:

```bash
# Option 1: Auto-generate migration (if local dev DB is in sync with schema.prisma)
npx prisma migrate dev --name fix_schema_drift

# Option 2: Manually create migration folder and SQL file
mkdir -p prisma/migrations/$(date +%Y%m%d)_fix_schema_drift

# Then create migration.sql with appropriate ALTER TABLE statements
```

**Example migration SQL for common drift issues:**

```sql
-- Add missing column
ALTER TABLE "MasterParts" ADD COLUMN IF NOT EXISTS "customPricePerLb" DOUBLE PRECISION;

-- Create missing table
CREATE TABLE IF NOT EXISTS "GlobalSettings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'number',
    "category" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GlobalSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GlobalSettings_key_key" ON "GlobalSettings"("key");
```

---

## STEP 5: Verify Sync

### 5.1 Check Final Status

```bash
cd /home/kylepalmer/Door-Quoter && DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate status
```

**Expected:** `Database schema is up to date!`

### 5.2 Re-run Drift Detection

Run the drift detection from Step 3.3 again to confirm no drift remains.

**Expected output:** `*** NO DRIFT DETECTED - Schema is in sync! ***`

### 5.3 Test Connection

```bash
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
Promise.all([prisma.product.count(), prisma.user.count(), prisma.masterPart.count()])
.then(([products, users, parts]) => {
  console.log('Production Counts - Products:', products, '| Users:', users, '| MasterParts:', parts);
  prisma.\$disconnect();
}).catch(e => console.error('Error:', e.message));
"
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
| Schema Drift | None detected |
| Connection | Verified |
| Tables | [count] |
| Products | [count] |
| Proxy | Stopped |
```

---

## Quick Reference

```bash
# Start proxy manually
~/cloud_sql_proxy door-quoter:us-central1:door-app-db --port 5433 &

# Check status
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate status

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
| Instance | door-quoter:us-central1:door-app-db |

---

## Expected Schema Metrics (Update when schema changes)

| Metric | Value |
|--------|-------|
| Total Tables | 50 |
| MasterParts columns | 26 |
| Openings columns | 21 |
| ProductBOMs columns | 22 |
| Users columns | 11 |
| ExtrusionVariants columns | 14 |
| GlobalSettings columns | 8 |

*Last updated: 2026-01-08*

---

*Syncs production database only. Use /db-sync-stage for staging.*
