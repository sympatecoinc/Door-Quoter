# Manual Database Migration Guide

## Overview
This guide documents the complete process for manually migrating database structure from staging to production using gcloud commands and Prisma. Use this when you need to sync schema changes that aren't automatically deployed.

## Database Environment Details

### Staging Database
- **Instance**: `door-quoter:us-central1:door-app-staging`
- **Database**: `postgres`
- **User**: `postgres`
- **Password**: `StagingDB123`
- **Port**: 5432 (via Cloud SQL proxy)

### Production Database
- **Instance**: `door-quoter:us-central1:door-app-db`
- **Database**: `door_quoter`
- **User**: `postgres`
- **Password**: `SimplePass123`
- **Port**: 5433 (via Cloud SQL proxy)

## Step-by-Step Migration Process

### Step 1: Verify gcloud Permissions
```bash
# Check authentication status
gcloud auth list

# Verify correct project
gcloud config get-value project

# List SQL instances to confirm access
gcloud sql instances list
```

**Expected Output:**
```
NAME              DATABASE_VERSION  LOCATION       TIER              STATUS
door-app-db       POSTGRES_15       us-central1-a  db-custom-2-7680  RUNNABLE
door-app-staging  POSTGRES_15       us-central1-c  db-custom-1-3840  RUNNABLE
```

### Step 2: Start Cloud SQL Proxy for Production
```bash
# Kill any existing production proxy (optional)
pkill -f "cloud_sql_proxy.*door-app-db" || echo "No existing production proxy found"

# Start proxy for production database on port 5433
~/cloud_sql_proxy -instances=door-quoter:us-central1:door-app-db=tcp:5433 > prod-proxy.log 2>&1 &

# Wait for startup
sleep 3

# Verify proxy is running
ss -tlnp | grep ':5433'
```

**Expected Output:**
```
LISTEN 0      4096       127.0.0.1:5433       0.0.0.0:*    users:(("cloud_sql_proxy",pid=XXXXX,fd=7))
```

### Step 3: Check Migration Status
```bash
# Check what migrations exist and their status
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate status
```

**Possible Scenarios:**

#### Scenario A: Database is up to date
```
Database schema is up to date!
```
→ No action needed, migration complete.

#### Scenario B: Pending migrations exist
```
Following migration have not yet been applied:
20250927101915_init
```
→ Continue to Step 4 to apply migrations.

#### Scenario C: Database schema exists but no migration history
```
The database schema is not empty. Read more about how to baseline an existing production database
```
→ Continue to Step 4 for baselining process.

### Step 4: Handle Migration Scenarios

#### For Scenario B (Pending migrations):
```bash
# Apply pending migrations
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate deploy
```

#### For Scenario C (Database exists but no migration history):
```bash
# 1. Mark existing migrations as applied (baseline)
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate resolve --applied 20250927101915_init

# 2. Apply any remaining migrations
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate deploy
```

**Note:** Replace `20250927101915_init` with the actual migration name from your `prisma/migrations/` directory.

### Step 5: Verify Migration Success
```bash
# 1. Check final migration status
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate status

# 2. Test database connection
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" node test-db.js
```

**Expected Success Output:**
```
# Migration status:
Database schema is up to date!

# Connection test:
✓ Database connected successfully
✓ Products fetched successfully: X
```

### Step 6: Cleanup (Optional)
```bash
# Stop the production proxy if no longer needed
pkill -f "cloud_sql_proxy.*door-app-db"
```

## Important Notes and Troubleshooting

### SSL/TLS Connection Issues
If you encounter TLS handshake errors:
```
Error: P1011: Error opening a TLS connection: error performing TLS handshake: server does not support TLS
```

**Solution:** Use `sslmode=disable` when connecting through the local Cloud SQL proxy:
```bash
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable"
```

### Database Not Empty Error
If you see:
```
Error: P3005 The database schema is not empty
```

**Solution:** Baseline the existing database by marking current migrations as applied:
```bash
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable" npx prisma migrate resolve --applied [MIGRATION_NAME]
```

### Finding Migration Names
```bash
# List all migration files
ls prisma/migrations/

# Get the most recent migration name
ls prisma/migrations/ | tail -1
```

### Permission Issues
If you get authentication errors:
```bash
# Re-authenticate with gcloud
gcloud auth login

# Set the correct project
gcloud config set project door-quoter
```

## Alternative Migration Methods

### Method 1: Schema Dump and Restore (For major changes)
```bash
# 1. Connect to staging and export schema
gcloud sql connect door-app-staging --user=postgres --database=postgres
pg_dump -h localhost -U postgres -d postgres --schema-only > staging_schema.sql

# 2. Connect to production and apply
gcloud sql connect door-app-db --user=postgres --database=door_quoter
\i staging_schema.sql
```

### Method 2: Cloud SQL Export/Import (Full database)
```bash
# Export from staging
gcloud sql export sql door-app-staging gs://your-backup-bucket/staging-export.sql --database=postgres

# Import to production (CAUTION: This overwrites data)
gcloud sql import sql door-app-db gs://your-backup-bucket/staging-export.sql --database=door_quoter
```

## Safety Best Practices

### Before Migration
1. **Test locally first** - Always test schema changes in development
2. **Review migration files** - Check what each migration does
3. **Backup production** (if critical data exists):
   ```bash
   gcloud sql export sql door-app-db gs://your-backup-bucket/backup-$(date +%Y%m%d-%H%M%S).sql --database=door_quoter
   ```

### During Migration
1. **Monitor logs** - Check `prod-proxy.log` for connection issues
2. **Use transactions** - Prisma migrations run in transactions automatically
3. **Verify each step** - Check migration status after each command

### After Migration
1. **Test application** - Ensure app connects and functions properly
2. **Check data integrity** - Verify important data is intact
3. **Monitor performance** - Watch for any performance impacts

## Files and Commands Reference

### Key Files
- **Schema**: `prisma/schema.prisma`
- **Migrations**: `prisma/migrations/`
- **Connection test**: `test-db.js`
- **Proxy logs**: `prod-proxy.log`

### Essential Commands
```bash
# Migration management
npx prisma migrate status          # Check migration status
npx prisma migrate deploy          # Apply pending migrations
npx prisma migrate resolve         # Mark migrations as applied/rolled back

# Database operations
npx prisma db push                 # Push schema changes (dev only)
npx prisma studio                  # Open database browser
npx prisma generate                # Regenerate Prisma client

# Cloud SQL operations
gcloud sql instances list          # List database instances
gcloud sql connect [INSTANCE]      # Connect directly to database
~/cloud_sql_proxy -instances=...   # Start local proxy
```

## Environment Variables Templates

### Local Development
```bash
DATABASE_URL="postgresql://postgres:DoorQuoter2024!@127.0.0.1:5432/postgres?sslmode=require"
```

### Production (via proxy)
```bash
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable"
```

### Staging (via proxy)
```bash
DATABASE_URL="postgresql://postgres:StagingDB123@127.0.0.1:5432/postgres?sslmode=disable"
```

---

**Last Updated**: September 27, 2025
**Tested On**: Door Quoter production environment
**Status**: ✅ Verified working process