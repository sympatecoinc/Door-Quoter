# Name: MANUAL_DATABASE_MIGRATION
# Date: 09-27-25

## Scope
Manual migration of database structure from staging to production using gcloud commands:
- Source: door-app-staging instance (postgres database)
- Target: door-app-db instance (door_quoter database)

## Database Connection Details
**Staging Database:**
- Instance: `door-quoter:us-central1:door-app-staging`
- Database: `postgres`
- User: `postgres`
- Password: `StagingDB123`

**Production Database:**
- Instance: `door-quoter:us-central1:door-app-db`
- Database: `door_quoter`
- User: `postgres`
- Password: `SimplePass123`

## Manual Migration Commands

### Option 1: Using Prisma Migrate Deploy (Recommended)
```bash
# 1. Connect to production via Cloud SQL proxy
~/cloud_sql_proxy -instances=door-quoter:us-central1:door-app-db=tcp:5433 &

# 2. Set production DATABASE_URL and run migrations
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=require" npx prisma migrate deploy

# 3. Verify migration status
DATABASE_URL="postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=require" npx prisma migrate status
```

### Option 2: Direct gcloud SQL Commands
```bash
# 1. Export current staging schema
gcloud sql export sql door-app-staging gs://your-backup-bucket/staging-schema-$(date +%Y%m%d-%H%M%S).sql \
  --database=postgres \
  --offload

# 2. Import schema to production (CAUTION: This will overwrite)
gcloud sql import sql door-app-db gs://your-backup-bucket/staging-schema-TIMESTAMP.sql \
  --database=door_quoter
```

### Option 3: Manual Schema Comparison
```bash
# 1. Connect to staging database
gcloud sql connect door-app-staging --user=postgres --database=postgres

# 2. Export schema only (no data)
pg_dump -h localhost -U postgres -d postgres --schema-only > staging_schema.sql

# 3. Connect to production database
gcloud sql connect door-app-db --user=postgres --database=door_quoter

# 4. Review and apply schema changes manually
\i staging_schema.sql
```

## Tasks
- [ ] Task 1: Backup production database before migration
- [ ] Task 2: Connect to production database via gcloud
- [ ] Task 3: Run Prisma migrate deploy to apply schema changes
- [ ] Task 4: Verify migration completed successfully
- [ ] Task 5: Test application connectivity to production database

## Success Criteria
- All Prisma migrations applied to production database
- Production database schema matches staging/development schema
- Application can connect to production database successfully
- No data loss in production database