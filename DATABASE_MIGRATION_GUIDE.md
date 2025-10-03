# Database Migration Guide

## Manual Production Database Update

### Step 1: Start Cloud SQL Proxy
```bash
# Start proxy for production database
~/cloud_sql_proxy -instances=door-quoter:us-central1:door-app-db=tcp:5433 &

# Wait for initialization
sleep 5
```

### Step 2: Check Current Schema
```bash
# View current table structure
PGPASSWORD=SimplePass123 psql -h 127.0.0.1 -p 5433 -U postgres -d door_quoter -c "\d \"Projects\""
```

### Step 3: Add New Columns
```bash
# Add text column with default
PGPASSWORD=SimplePass123 psql -h 127.0.0.1 -p 5433 -U postgres -d door_quoter -c "ALTER TABLE \"Projects\" ADD COLUMN IF NOT EXISTS \"extrusionCostingMethod\" TEXT NOT NULL DEFAULT 'FULL_STOCK';"

# Add array column
PGPASSWORD=SimplePass123 psql -h 127.0.0.1 -p 5433 -U postgres -d door_quoter -c "ALTER TABLE \"Projects\" ADD COLUMN IF NOT EXISTS \"excludedPartNumbers\" TEXT[] NOT NULL DEFAULT '{}';"
```

### Step 4: Verify Changes
```bash
# Confirm columns were added
PGPASSWORD=SimplePass123 psql -h 127.0.0.1 -p 5433 -U postgres -d door_quoter -c "\d \"Projects\""
```

### Step 5: Stop Proxy
```bash
pkill -f cloud_sql_proxy
```

## Common Column Types

```sql
-- Text column
ALTER TABLE "TableName" ADD COLUMN IF NOT EXISTS "columnName" TEXT NOT NULL DEFAULT 'value';

-- Array column
ALTER TABLE "TableName" ADD COLUMN IF NOT EXISTS "columnName" TEXT[] NOT NULL DEFAULT '{}';

-- Integer column
ALTER TABLE "TableName" ADD COLUMN IF NOT EXISTS "columnName" INTEGER NOT NULL DEFAULT 0;

-- Boolean column
ALTER TABLE "TableName" ADD COLUMN IF NOT EXISTS "columnName" BOOLEAN NOT NULL DEFAULT false;

-- Nullable column (no default needed)
ALTER TABLE "TableName" ADD COLUMN IF NOT EXISTS "columnName" TEXT;
```

## Database Info

**Production**
- Instance: `door-app-db`
- Database: `door_quoter`
- User: `postgres`
- Password: `SimplePass123`
- Connection: `postgresql://postgres:SimplePass123@127.0.0.1:5433/door_quoter?sslmode=disable`

**Staging**
- Instance: `door-app-staging`
- Database: `postgres`
- User: `postgres`
- Password: `StagingDB123`
- Connection: `postgresql://postgres:StagingDB123@127.0.0.1:5432/postgres?sslmode=disable`