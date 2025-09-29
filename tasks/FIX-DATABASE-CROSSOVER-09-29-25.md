# Name: FIX-DATABASE-CROSSOVER
# Date: 09-29-25

## Problem Analysis
The staging and production Cloud Run instances got their databases crossed.

### Expected Configuration (from DEPLOYMENT_GUIDE.md)
- **Dev + Staging**: Should share `door-app-staging` database (postgres DB)
- **Production**: Should use separate `door-app-db` database (door_quoter DB)

### Current Configuration Analysis
Files to verify:
- `.github/workflows/deploy-staging.yml`: DATABASE_URL configuration
- `.github/workflows/deploy-production.yml`: DATABASE_URL configuration
- Current Cloud Run service configurations (need to check live)

## Scope

### Phase 1: Verification (Read-Only)
- [ ] Check current DATABASE_URL in staging workflow file
- [ ] Check current DATABASE_URL in production workflow file
- [ ] Verify staging Cloud Run service environment variables (if accessible)
- [ ] Verify production Cloud Run service environment variables (if accessible)
- [ ] Document what is currently configured vs what should be configured

### Phase 2: Correction Plan (Awaiting Approval)
Files that MAY need modification:
- `.github/workflows/deploy-staging.yml`: Fix DATABASE_URL if incorrect
- `.github/workflows/deploy-production.yml`: Fix DATABASE_URL if incorrect

## Current Findings

### Staging Configuration (.github/workflows/deploy-staging.yml:54)
```yaml
DATABASE_URL=postgresql://postgres:StagingDB123@localhost/postgres?host=/cloudsql/door-quoter:us-central1:door-app-staging
```
✅ **CORRECT** - Points to `door-app-staging` instance

### Production Configuration (.github/workflows/deploy-production.yml:61)
```yaml
DATABASE_URL=postgresql://postgres:SimplePass123@localhost/door_quoter?host=/cloudsql/door-quoter:us-central1:door-app-db
```
✅ **CORRECT** - Points to `door-app-db` instance

### Current Status
Both workflow files have CORRECT database configurations. The issue must be:
1. Environment variables on the live Cloud Run services are wrong, OR
2. A recent deployment used incorrect values, OR
3. Manual configuration changes were made to Cloud Run services

## Root Cause Analysis

### The Prisma Migration Story

**Timeline of Events:**

1. **Commit 5da7dfc** (Sep 26): Added automatic database migration step to production workflow
   - Added `npx prisma migrate deploy` step BEFORE Docker build
   - Used DATABASE_URL: `postgresql://postgres:SimplePass123@door-quoter:us-central1:door-app-db/door_quoter`
   - **PROBLEM**: This format is INCORRECT for Cloud SQL connections

2. **Commit e0fbed7** (Sep 26): "Updated Workflow for database migration to Production"
   - Same incorrect DATABASE_URL format (missing `@localhost` and `?host=` parameter)
   - Migration step attempted to connect to production DB but with wrong format

3. **Commit 02e01b0** (Sep 27): "updated database migration files"
   - **REMOVED** the migration step entirely from production workflow
   - Consolidated all migrations into two files:
     - `20250927101915_init/migration.sql` (base schema - 253 lines)
     - `20250927105844_add_crm_tables/migration.sql` (CRM additions - 93 lines)

4. **Current State**: Production workflow NO LONGER runs migrations automatically
   - Migration step was removed after it failed to work properly
   - Current DATABASE_URL in Cloud Run env_vars is CORRECT
   - But migrations may not have been applied to production database

### The REAL Problem

**It's NOT about workflow files being wrong** - those are correct now.

**The issue is**: When the migration step was running (commits 5da7dfc and e0fbed7), it used an **incorrect DATABASE_URL format** that may have:
1. Failed to connect to production database entirely, OR
2. Connected to the wrong database due to malformed connection string, OR
3. Never ran successfully, leaving production DB out of sync

### What Likely Happened

The incorrect DATABASE_URL format in the migration step:
```yaml
# WRONG (used in 5da7dfc and e0fbed7)
DATABASE_URL: postgresql://postgres:SimplePass123@door-quoter:us-central1:door-app-db/door_quoter

# CORRECT (should have been)
DATABASE_URL: postgresql://postgres:SimplePass123@localhost/door_quoter?host=/cloudsql/door-quoter:us-central1:door-app-db
```

This means:
- **Staging**: May have received migrations successfully (if it had correct format)
- **Production**: Migrations likely FAILED or never applied, leaving schema out of sync
- **Result**: Both environments pointing to correct DBs in Cloud Run, but production DB missing CRM tables

## Verification Needed

1. Check if production database has CRM tables (Customers, Leads, Activities, etc.)
2. Check if staging database has CRM tables
3. Verify migration history in both databases: `SELECT * FROM _prisma_migrations;`

## Next Steps Required

### Option 1: Redeploy Production (Will NOT fix missing migrations)
- Current workflow has correct DATABASE_URL for runtime
- But NO migration step, so schema won't be updated
- **NOT RECOMMENDED** - Won't solve the problem

### Option 2: Manually Run Migrations on Production Database (RECOMMENDED)
```bash
# Connect to production via Cloud SQL proxy on different port
~/cloud_sql_proxy -instances=door-quoter:us-central1:door-app-db=tcp:5433 &

# Run migrations against production
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=require" npx prisma migrate deploy

# Verify
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=require" npx prisma migrate status
```

### Option 3: Add Migration Step Back to Workflow (With Correct Format)
Re-add the migration step to `.github/workflows/deploy-production.yml` with CORRECT DATABASE_URL:
```yaml
- name: Run Database Migrations
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: postgresql://postgres:SimplePass123@localhost/door_quoter?host=/cloudsql/door-quoter:us-central1:door-app-db
```

## Success Criteria
- Production database has all tables from both migrations (base + CRM)
- Staging database has all tables from both migrations (base + CRM)
- `_prisma_migrations` table shows both migrations as applied in both databases
- Application can query CRM tables in production without errors
- Both environments are fully operational with correct data isolation