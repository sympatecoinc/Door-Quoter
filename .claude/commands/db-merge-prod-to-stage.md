---
allowed-tools: Bash, Read, Glob, Grep
---

# Database Merge - Production to Staging

Perform a **full data replace** from production to staging, making staging an exact data mirror of production (excluding auth/system tables).

## Overview

This command will:
1. Verify gcloud authentication
2. Start Cloud SQL proxies for BOTH production and staging
3. **Create backup of staging database** (CRITICAL safety step)
4. Export production data (excluding system tables)
5. Clear staging tables and import production data
6. **Clear QuickBooks sync fields** (staging uses different QB instance)
7. Verify row counts match between databases
8. Cleanup proxies and temporary files

**WARNING: This is a destructive operation that will replace all data in staging!**

---

## Tables Excluded

The following tables are **NOT** copied from production to staging:

| Table | Reason |
|-------|--------|
| User | Staging may have different test users |
| Session | Environment-specific session data |
| Portal | Portal configurations may differ |
| Profile | Permission profiles may differ |
| QuickBooksToken | OAuth tokens are environment-specific |
| GlobalSetting | System settings may differ |
| _prisma_migrations | Migration history stays separate |

---

## STEP 1: Pre-flight Checks

### 1.1 Announce Merge Session

```
⚠️  DATABASE MERGE: Production → Staging

This operation will:
- REPLACE all data in staging with production data
- Preserve staging auth/system tables (User, Session, Portal, Profile, QuickBooksToken, GlobalSetting)
- Create a backup of staging before making changes

Target databases:
- Source: door-app-db (Production, port 5433)
- Destination: door-app-staging (Staging, port 5434)

Checking prerequisites...
```

### 1.2 Verify Prerequisites

Run these checks in parallel:

```bash
# Check gcloud auth
~/google-cloud-sdk/bin/gcloud auth list --filter=status:ACTIVE --format="value(account)"

# Check project
~/google-cloud-sdk/bin/gcloud config get-value project
```

**Expected project:** `linea-door-quoter`

If not authenticated or wrong project, fix before continuing.

### 1.3 Request Explicit Confirmation

**CRITICAL: This is a destructive operation. You MUST ask the user for confirmation before proceeding.**

Ask the user:
```
⚠️  CONFIRMATION REQUIRED

This will REPLACE all data in staging with production data.
Excluded tables (User, Session, Portal, Profile, QuickBooksToken, GlobalSetting, _prisma_migrations) will be preserved.

A backup of staging will be created before any changes.

Type "MERGE" to confirm you want to proceed.
```

**Do NOT proceed until user explicitly confirms with "MERGE".**

---

## STEP 2: Setup Cloud SQL Proxies

### 2.1 Kill Existing Proxies

```bash
pkill -f "cloud_sql_proxy.*door-app-db" || echo "No existing production proxy"
pkill -f "cloud_sql_proxy.*door-app-staging" || echo "No existing staging proxy"
sleep 2
```

### 2.2 Start Both Proxies

```bash
# Production proxy (port 5433)
~/cloud_sql_proxy linea-door-quoter:us-central1:door-app-db --port 5433 \
  --credentials-file=/home/kylepalmer/Door-Quoter/github-actions-key.json > /tmp/prod-proxy.log 2>&1 &

# Staging proxy (port 5434)
~/cloud_sql_proxy linea-door-quoter:us-central1:door-app-staging --port 5434 \
  --credentials-file=/home/kylepalmer/Door-Quoter/github-actions-key.json > /tmp/staging-proxy.log 2>&1 &

sleep 3
```

### 2.3 Verify Both Proxies Running

```bash
pgrep -a cloud_sql_proxy | grep door-app
ss -tlnp | grep -E ':543[34]'
```

If either proxy failed, check `/tmp/prod-proxy.log` or `/tmp/staging-proxy.log` and report error.

---

## STEP 3: Backup Staging Database (CRITICAL)

**This backup is your safety net. ALWAYS create it before making changes.**

```bash
mkdir -p /home/kylepalmer/Door-Quoter/backups
PGPASSWORD=StagingDB123 pg_dump -h 127.0.0.1 -p 5434 -U postgres -d postgres \
  -F c -f /home/kylepalmer/Door-Quoter/backups/staging_backup_before_merge_$(date +%Y-%m-%d_%H%M%S).dump
```

Verify backup was created:

```bash
ls -la /home/kylepalmer/Door-Quoter/backups/staging_backup_before_merge_*.dump | tail -1
```

**Do NOT proceed if backup fails!**

---

## STEP 4: Export Production Data

Export all production data EXCEPT excluded system tables:

```bash
PGPASSWORD=SimplePass123 pg_dump -h 127.0.0.1 -p 5433 -U postgres -d door_quoter \
  --data-only \
  --disable-triggers \
  --exclude-table=User \
  --exclude-table=Session \
  --exclude-table=Portal \
  --exclude-table=Profile \
  --exclude-table=QuickBooksToken \
  --exclude-table=GlobalSetting \
  --exclude-table=_prisma_migrations \
  -f /tmp/prod_data_export.sql
```

Verify export was created:

```bash
ls -la /tmp/prod_data_export.sql
head -50 /tmp/prod_data_export.sql
```

---

## STEP 5: Clear Staging & Import Production Data

### 5.1 Truncate Staging Tables (Excluding System Tables)

```bash
PGPASSWORD=StagingDB123 psql -h 127.0.0.1 -p 5434 -U postgres -d postgres -c "
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables
              WHERE schemaname = 'public'
              AND tablename NOT IN ('User', 'Session', 'Portal', 'Profile',
                                    'QuickBooksToken', 'GlobalSetting', '_prisma_migrations'))
    LOOP
        EXECUTE 'TRUNCATE TABLE \"' || r.tablename || '\" CASCADE';
    END LOOP;
END \$\$;
"
```

### 5.2 Import Production Data into Staging

```bash
PGPASSWORD=StagingDB123 psql -h 127.0.0.1 -p 5434 -U postgres -d postgres \
  -f /tmp/prod_data_export.sql
```

### 5.3 Clear QuickBooks Sync Fields

**IMPORTANT:** Staging and production connect to different QuickBooks instances. The production `quickbooksId` values are invalid in staging's QB environment. Clear these fields so staging can establish fresh QB links.

```bash
PGPASSWORD=StagingDB123 psql -h 127.0.0.1 -p 5434 -U postgres -d postgres -c "
-- Clear QB sync fields on Customer
UPDATE \"Customer\" SET \"quickbooksId\" = NULL, \"syncToken\" = NULL, \"lastSyncedAt\" = NULL;

-- Clear QB sync fields on SalesOrder (maps to QB Estimates)
UPDATE \"SalesOrder\" SET \"quickbooksId\" = NULL, \"syncToken\" = NULL, \"lastSyncedAt\" = NULL;

-- Clear QB sync fields on Invoice
UPDATE \"Invoice\" SET \"quickbooksId\" = NULL, \"syncToken\" = NULL, \"lastSyncedAt\" = NULL;

-- Clear QB sync fields on Vendor
UPDATE \"Vendor\" SET \"quickbooksId\" = NULL, \"syncToken\" = NULL, \"lastSyncedAt\" = NULL;

-- Clear QuickBooksItem links (MasterPart to QB Item mappings)
TRUNCATE TABLE \"QuickBooksItem\" CASCADE;

SELECT 'QuickBooks sync fields cleared' as status;
"
```

This ensures:
- Customers, SalesOrders, Invoices, Vendors appear as "never synced" in staging
- Next QB sync will create fresh links to staging's QuickBooks company
- No orphan QB references that could cause sync failures

---

## STEP 6: Verification

### 6.1 Compare Row Counts

```bash
echo "=== Production Counts ==="
PGPASSWORD=SimplePass123 psql -h 127.0.0.1 -p 5433 -U postgres -d door_quoter -c "
SELECT 'Project' as table_name, COUNT(*) FROM \"Project\"
UNION ALL SELECT 'Customer', COUNT(*) FROM \"Customer\"
UNION ALL SELECT 'MasterPart', COUNT(*) FROM \"MasterPart\"
UNION ALL SELECT 'Product', COUNT(*) FROM \"Product\"
UNION ALL SELECT 'ProjectItem', COUNT(*) FROM \"ProjectItem\"
UNION ALL SELECT 'ProjectItemPart', COUNT(*) FROM \"ProjectItemPart\"
ORDER BY table_name;
"

echo ""
echo "=== Staging Counts ==="
PGPASSWORD=StagingDB123 psql -h 127.0.0.1 -p 5434 -U postgres -d postgres -c "
SELECT 'Project' as table_name, COUNT(*) FROM \"Project\"
UNION ALL SELECT 'Customer', COUNT(*) FROM \"Customer\"
UNION ALL SELECT 'MasterPart', COUNT(*) FROM \"MasterPart\"
UNION ALL SELECT 'Product', COUNT(*) FROM \"Product\"
UNION ALL SELECT 'ProjectItem', COUNT(*) FROM \"ProjectItem\"
UNION ALL SELECT 'ProjectItemPart', COUNT(*) FROM \"ProjectItemPart\"
ORDER BY table_name;
"
```

**Verify:** All row counts should match between production and staging.

### 6.2 Verify Excluded Tables Were Preserved

```bash
echo "=== Staging System Tables (should NOT be empty) ==="
PGPASSWORD=StagingDB123 psql -h 127.0.0.1 -p 5434 -U postgres -d postgres -c "
SELECT 'User' as table_name, COUNT(*) FROM \"User\"
UNION ALL SELECT 'Profile', COUNT(*) FROM \"Profile\"
UNION ALL SELECT 'GlobalSetting', COUNT(*) FROM \"GlobalSetting\";
"
```

### 6.3 Confirm or Rollback

**After showing the verification results, ask the user:**

```
✓ Merge complete. Please review the row counts above.

Do the counts look correct?
- If YES: Type "CONFIRM" to finalize and cleanup
- If NO:  Type "ROLLBACK" to restore staging from backup
```

**If user types "ROLLBACK":**

1. Find the backup created earlier:
```bash
BACKUP_FILE=$(ls -t /home/kylepalmer/Door-Quoter/backups/staging_backup_before_merge_*.dump | head -1)
echo "Restoring from: $BACKUP_FILE"
```

2. Restore staging from backup:
```bash
PGPASSWORD=StagingDB123 pg_restore -h 127.0.0.1 -p 5434 -U postgres -d postgres \
  --clean --if-exists "$BACKUP_FILE"
```

3. Verify rollback succeeded:
```bash
echo "=== Staging Counts After Rollback ==="
PGPASSWORD=StagingDB123 psql -h 127.0.0.1 -p 5434 -U postgres -d postgres -c "
SELECT 'Project' as table_name, COUNT(*) FROM \"Project\"
UNION ALL SELECT 'Customer', COUNT(*) FROM \"Customer\"
UNION ALL SELECT 'MasterPart', COUNT(*) FROM \"MasterPart\"
UNION ALL SELECT 'Product', COUNT(*) FROM \"Product\"
ORDER BY table_name;
"
```

4. Report rollback complete and skip to STEP 7 cleanup.

**If user types "CONFIRM":** Continue to STEP 7.

---

## STEP 7: Cleanup

### 7.1 Remove Temporary Files

```bash
rm -f /tmp/prod_data_export.sql
```

### 7.2 Stop Proxies

```bash
pkill -f "cloud_sql_proxy.*door-app-db"
pkill -f "cloud_sql_proxy.*door-app-staging"
```

### 7.3 Final Report

```markdown
## Production → Staging Merge Complete

**Date:** [YYYY-MM-DD HH:MM]

| Step | Status |
|------|--------|
| Staging Backup | Created |
| Production Export | Complete |
| Staging Truncate | Complete |
| Data Import | Complete |
| QB Sync Fields | Cleared |
| Verification | Row counts match |
| Cleanup | Complete |

**Backup Location:** backups/staging_backup_before_merge_[TIMESTAMP].dump

**Tables Merged:**
- Project, Customer, MasterPart, Product, ProjectItem, ProjectItemPart, etc.

**Tables Preserved (not overwritten):**
- User, Session, Portal, Profile, QuickBooksToken, GlobalSetting, _prisma_migrations

**QuickBooks Sync Fields Cleared:**
- Customer, SalesOrder, Invoice, Vendor (quickbooksId, syncToken, lastSyncedAt set to NULL)
- QuickBooksItem table truncated (MasterPart-to-QB-Item links removed)
```

---

## Rollback Procedure

If something goes wrong, restore staging from the backup:

### 1. Start Staging Proxy

```bash
~/cloud_sql_proxy linea-door-quoter:us-central1:door-app-staging --port 5434 \
  --credentials-file=/home/kylepalmer/Door-Quoter/github-actions-key.json &
sleep 3
```

### 2. Find Most Recent Backup

```bash
ls -la /home/kylepalmer/Door-Quoter/backups/staging_backup_before_merge_*.dump | tail -1
```

### 3. Restore from Backup

```bash
# Replace [TIMESTAMP] with actual backup filename
PGPASSWORD=StagingDB123 pg_restore -h 127.0.0.1 -p 5434 -U postgres -d postgres \
  --clean --if-exists /home/kylepalmer/Door-Quoter/backups/staging_backup_before_merge_[TIMESTAMP].dump
```

### 4. Stop Proxy

```bash
pkill -f "cloud_sql_proxy.*door-app-staging"
```

---

## Quick Reference

### Connection Strings

| Environment | Connection String |
|-------------|-------------------|
| Production | `postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable` |
| Staging | `postgresql://postgres:StagingDB123@127.0.0.1:5434/postgres?sslmode=disable` |

### Credentials

| Environment | Host | Port | User | Database | Password |
|-------------|------|------|------|----------|----------|
| Production | 127.0.0.1 | 5433 | postgres | door_quoter | SimplePass123 |
| Staging | 127.0.0.1 | 5434 | postgres | postgres | StagingDB123 |

### Proxy Commands

```bash
# Start production proxy
~/cloud_sql_proxy linea-door-quoter:us-central1:door-app-db --port 5433 \
  --credentials-file=/home/kylepalmer/Door-Quoter/github-actions-key.json &

# Start staging proxy
~/cloud_sql_proxy linea-door-quoter:us-central1:door-app-staging --port 5434 \
  --credentials-file=/home/kylepalmer/Door-Quoter/github-actions-key.json &

# Stop all proxies
pkill -f "cloud_sql_proxy"
```

---

## Troubleshooting

### Proxy Connection Fails

Check the proxy logs:
```bash
cat /tmp/prod-proxy.log
cat /tmp/staging-proxy.log
```

### Import Fails with Foreign Key Errors

The `--disable-triggers` flag should prevent this, but if it still occurs:
1. Check that you're using the correct export command
2. Ensure the pg_dump includes `--disable-triggers`

### Row Counts Don't Match

1. Check for errors in the import output
2. Verify the export file is complete: `tail -50 /tmp/prod_data_export.sql`
3. Consider re-running the export and import

### Need to Cancel Mid-Operation

If you need to stop mid-operation, restore from backup immediately:
```bash
ls /home/kylepalmer/Door-Quoter/backups/staging_backup_before_merge_*.dump | tail -1
# Then follow the rollback procedure above
```

---

*Last updated: 2026-01-29*

*Merges production data to staging. Use /db-sync-prod or /db-sync-stage for schema sync only.*
