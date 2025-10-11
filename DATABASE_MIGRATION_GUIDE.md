# Database Migration Guide

## Latest Migration (2025-10-03): Glass Pricing System

### Step 1: Start Cloud SQL Proxy
```bash
# Start proxy for production database
~/cloud_sql_proxy -instances=door-quoter:us-central1:door-app-db=tcp:5433 &

# Wait for initialization
sleep 5
```

### Step 2: Add GlassTypes Table
```bash
PGPASSWORD=SimplePass123 psql -h 127.0.0.1 -p 5433 -U postgres -d door_quoter -c "
CREATE TABLE IF NOT EXISTS \"GlassTypes\" (
  \"id\" SERIAL PRIMARY KEY,
  \"name\" TEXT UNIQUE NOT NULL,
  \"description\" TEXT,
  \"pricePerSqFt\" DOUBLE PRECISION NOT NULL,
  \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);"
```

### Step 3: Add priceCalculatedAt to Openings
```bash
PGPASSWORD=SimplePass123 psql -h 127.0.0.1 -p 5433 -U postgres -d door_quoter -c "ALTER TABLE \"Openings\" ADD COLUMN IF NOT EXISTS \"priceCalculatedAt\" TIMESTAMP(3);"
```

### Step 4: Verify Changes
```bash
# Check GlassTypes table
PGPASSWORD=SimplePass123 psql -h 127.0.0.1 -p 5433 -U postgres -d door_quoter -c "\d \"GlassTypes\""

# Check Openings table
PGPASSWORD=SimplePass123 psql -h 127.0.0.1 -p 5433 -U postgres -d door_quoter -c "\d \"Openings\""
```

### Step 5: Stop Proxy
```bash
pkill -f cloud_sql_proxy
```

---

## Previous Migration: Extrusion Costing

### Add New Columns to Projects
```bash
# Add text column with default
PGPASSWORD=SimplePass123 psql -h 127.0.0.1 -p 5433 -U postgres -d door_quoter -c "ALTER TABLE \"Projects\" ADD COLUMN IF NOT EXISTS \"extrusionCostingMethod\" TEXT NOT NULL DEFAULT 'FULL_STOCK';"

# Add array column
PGPASSWORD=SimplePass123 psql -h 127.0.0.1 -p 5433 -U postgres -d door_quoter -c "ALTER TABLE \"Projects\" ADD COLUMN IF NOT EXISTS \"excludedPartNumbers\" TEXT[] NOT NULL DEFAULT '{}';"
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