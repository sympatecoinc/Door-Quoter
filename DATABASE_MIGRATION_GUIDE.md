# Database Migration Guide

## Overview
This document explains how automatic database migrations work in the Door Quoter application and how to safely update your production database while preserving all existing data.

## Database Architecture

### Environment Setup
| Environment | Database Instance | Database Name | Connection |
|-------------|------------------|---------------|------------|
| **Local Dev** | door-app-staging | postgres | Cloud SQL Proxy |
| **Staging** | door-app-staging | postgres | Cloud SQL Socket |
| **Production** | door-app-db | door_quoter | Cloud SQL Socket |

### Key Points
- **Staging and Local Dev share the same database** - Changes made locally affect staging
- **Production has its own isolated database** - Safe from development changes
- **Migrations are applied automatically** during production deployments

## How Automatic Migrations Work

### What Was Implemented (Option A)
Added automatic database migration to the production deployment workflow in `.github/workflows/deploy-production.yml`:

```yaml
- name: Set up Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '18'
    cache: 'npm'

- name: Install dependencies
  run: npm ci

- name: Run Database Migrations
  run: |-
    npx prisma migrate deploy
  env:
    DATABASE_URL: postgresql://postgres:SimplePass123@localhost/door_quoter?host=/cloudsql/door-quoter:us-central1:door-app-db
```

### What `npx prisma migrate deploy` Does
1. **Checks migration history** - Looks at `_prisma_migrations` table to see what's been applied
2. **Applies only new migrations** - Runs migration files that haven't been executed yet
3. **Preserves all existing data** - Only updates database structure, never deletes data
4. **Updates schema incrementally** - Adds new tables, columns, indexes as needed

## Safe Development Workflow

### 1. Making Schema Changes Locally
```bash
# Edit prisma/schema.prisma with your changes
# Test the changes locally first
npx prisma db push

# Generate a proper migration file
npx prisma migrate dev --name "descriptive_change_name"

# Verify everything works
npx prisma studio
npm run dev
```

### 2. Testing on Staging
```bash
# Push to staging branch to test in staging environment
git checkout staging
git add .
git commit -m "Add new database feature"
git push origin staging

# Test at: https://door-quoter-staging-259524707165.us-central1.run.app
```

### 3. Production Deployment
```bash
# Deploy to production (migrations run automatically)
git checkout main
git merge staging
git push origin main

# Monitor deployment at: https://github.com/sympatecoinc/Door-Quoter/actions
```

## What Happens During Production Deployment

### Deployment Sequence
1. **Code checkout** - Gets latest code from main branch
2. **Google Cloud authentication** - Sets up access to production resources
3. **Node.js setup** - Installs Node.js 18 and npm dependencies
4. **🔄 Database migration** - Runs `npx prisma migrate deploy` against production DB
5. **Docker build** - Creates new application container
6. **Cloud Run deployment** - Updates production application
7. **Health check** - Verifies deployment success

### Migration Safety Features
- **Incremental only** - Only applies new migrations, never re-runs old ones
- **Data preservation** - All existing data remains intact
- **Rollback safe** - Can be rolled back if issues occur
- **Atomic operations** - Each migration runs in a transaction

## Types of Safe Changes

### ✅ Always Safe (Additive Changes)
- Adding new tables
- Adding new columns (with default values or nullable)
- Adding new indexes
- Adding new enums or enum values

### ⚠️ Requires Careful Planning
- Dropping columns (plan data migration first)
- Changing column types (may require data conversion)
- Renaming tables or columns (use Prisma's `@map` attribute)
- Adding non-nullable columns to existing tables

### 🚨 Potentially Breaking
- Dropping tables (backup data first)
- Changing primary keys
- Removing enum values that are in use

## Troubleshooting

### Migration Fails During Deployment
1. **Check GitHub Actions logs** at https://github.com/sympatecoinc/Door-Quoter/actions
2. **Look for specific error** in the "Run Database Migrations" step
3. **Common issues:**
   - Syntax error in migration SQL
   - Constraint violations
   - Permission issues

### Emergency Rollback
```bash
# If production deployment fails, you can:
# 1. Revert the code changes
git revert HEAD
git push origin main

# 2. Or rollback specific migrations (if needed)
# Connect to production database manually:
gcloud sql connect door-app-db --user=postgres --database=door_quoter
# Then run: npx prisma migrate resolve --rolled-back [migration_name]
```

### Manual Migration (If Automatic Fails)
```bash
# Connect to production database
gcloud sql connect door-app-db --user=postgres --database=door_quoter

# Run migrations manually
npx prisma migrate deploy --schema=prisma/schema.prisma
```

## Best Practices

### Before Making Changes
1. **Always backup production** before major schema changes
2. **Test locally first** - Use `npx prisma db push` to test changes
3. **Test on staging** - Deploy to staging environment before production
4. **Use descriptive migration names** - Make it clear what each migration does

### Database Backups
```bash
# Create backup before major changes
gcloud sql export sql door-app-db gs://your-backup-bucket/backup-$(date +%Y%m%d-%H%M%S).sql

# Test migrations on a copy first (for major changes)
gcloud sql instances clone door-app-db door-app-test-clone
```

### Monitoring After Deployment
1. **Check application logs** in Google Cloud Console
2. **Verify data integrity** with a few test queries
3. **Monitor application performance** for any issues
4. **Test key functionality** to ensure everything works

## File Locations

### Important Files
- **Schema**: `prisma/schema.prisma` - Database schema definition
- **Migrations**: `prisma/migrations/` - All migration files
- **Workflow**: `.github/workflows/deploy-production.yml` - Deployment configuration
- **Test Script**: `test-db.js` - Database connection testing

### Commands Reference
```bash
# Local development
npm run dev                    # Start local dev with database proxy
npx prisma studio             # Open database browser
npx prisma db push            # Test schema changes locally

# Migration management
npx prisma migrate dev        # Create and apply new migration
npx prisma migrate deploy     # Apply migrations to target database
npx prisma migrate status     # Check migration status

# Database connection testing
node test-db.js               # Test database connection
```

## Support Information

### Database Credentials
- **Staging**: `door-app-staging` instance, `postgres` database, user: `postgres`, password: `StagingDB123`
- **Production**: `door-app-db` instance, `door_quoter` database, user: `postgres`, password: `SimplePass123`

### URLs
- **Staging**: https://door-quoter-staging-259524707165.us-central1.run.app
- **Production**: https://door-quoter-app-259524707165.us-central1.run.app
- **GitHub Actions**: https://github.com/sympatecoinc/Door-Quoter/actions

---

**Last Updated**: September 2025
**Status**: ✅ Automatic migrations active
**Implementation**: Option A - Automatic migration during deployment