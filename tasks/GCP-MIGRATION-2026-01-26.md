# GCP Account Migration: Personal to Business

**Date:** 2026-01-26
**Current Branch:** `dev`
**Status:** Planning/Documentation

---

## Overview

Migrate the Door-Quoter application from personal GCP account to a new business GCP account while maintaining all functionality and CI/CD workflows.

**Current Project ID:** `door-quoter`
**Region:** `us-central1`

---

## Current Infrastructure Inventory

### Cloud Run Services
| Service | Environment | URL |
|---------|-------------|-----|
| `door-quoter-staging` | Staging | https://door-quoter-staging-259524707165.us-central1.run.app |
| `door-quoter-app` | Production | https://door-quoter-app-259524707165.us-central1.run.app |

### Cloud SQL Instances
| Instance | Database | User | Password | Environment |
|----------|----------|------|----------|-------------|
| `door-app-staging` | `postgres` | `postgres` | `StagingDB123` | Staging + Local Dev |
| `door-app-db` | `door_quoter` | `postgres` | `SimplePass123` | Production |

### Other Services
- **Artifact Registry:** `us-central1-docker.pkg.dev/door-quoter/door-quoter-app/`
- **Service Account:** `github-actions@door-quoter.iam.gserviceaccount.com`

---

## Files Requiring Updates

### 1. `.github/workflows/deploy-staging.yml`

**Current content with references marked:**

```yaml
name: Deploy to Staging

on:
  push:
    branches: [ staging ]
  pull_request:
    branches: [ main ]

env:
  PROJECT_ID: door-quoter                    # <-- CHANGE TO NEW_PROJECT_ID
  GAR_LOCATION: us-central1
  SERVICE: door-quoter-staging
  REGION: us-central1

jobs:
  deploy:
    permissions:
      contents: read
      id-token: write

    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Google Auth
        id: auth
        uses: 'google-github-actions/auth@v2'
        with:
          credentials_json: '${{ secrets.GCP_SA_KEY }}'

      - name: 'Set up Cloud SDK'
        uses: 'google-github-actions/setup-gcloud@v2'
        with:
          project_id: ${{ env.PROJECT_ID }}

      - name: 'Docker auth'
        run: |-
          gcloud auth configure-docker ${{ env.GAR_LOCATION }}-docker.pkg.dev --quiet

      - name: Build and Push Container
        run: |-
          docker build -t "us-central1-docker.pkg.dev/door-quoter/door-quoter-app/door-quoter-app:staging-latest" ./
          docker push "us-central1-docker.pkg.dev/door-quoter/door-quoter-app/door-quoter-app:staging-latest"
          # ^^ CHANGE door-quoter to NEW_PROJECT_ID in both lines ^^

      - name: Deploy to Staging Cloud Run
        id: deploy
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ${{ env.SERVICE }}
          region: ${{ env.REGION }}
          image: us-central1-docker.pkg.dev/door-quoter/door-quoter-app/door-quoter-app:staging-latest
          # ^^ CHANGE door-quoter to NEW_PROJECT_ID ^^
          env_vars: |
            DATABASE_URL=postgresql://postgres:StagingDB123@localhost/postgres?host=/cloudsql/door-quoter:us-central1:door-app-staging
            NEXTAUTH_URL=https://door-quoter-staging-259524707165.us-central1.run.app
            NEXTAUTH_SECRET=staging-secret-key
            NODE_ENV=staging
            # ^^ DATABASE_URL: Change door-quoter to NEW_PROJECT_ID, update password if changed ^^
            # ^^ NEXTAUTH_URL: Will get new URL after first deployment (or use custom domain) ^^

      - name: Show Staging URL
        run: echo ${{ steps.deploy.outputs.url }}
```

**Lines to change:**
| Line | Current | Change To |
|------|---------|-----------|
| 10 | `PROJECT_ID: door-quoter` | `PROJECT_ID: NEW_PROJECT_ID` |
| 43 | `us-central1-docker.pkg.dev/door-quoter/door-quoter-app/...` | `us-central1-docker.pkg.dev/NEW_PROJECT_ID/door-quoter-app/...` |
| 44 | Same as above | Same pattern |
| 52 | Same as above | Same pattern |
| 54 | `host=/cloudsql/door-quoter:us-central1:door-app-staging` | `host=/cloudsql/NEW_PROJECT_ID:us-central1:door-app-staging` |
| 54 | `StagingDB123` | `NEW_STAGING_PASSWORD` (if changed) |
| 55 | `https://door-quoter-staging-259524707165...` | Update after first deploy or use custom domain |

---

### 2. `.github/workflows/deploy-production.yml`

**Current content with references marked:**

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

env:
  PROJECT_ID: door-quoter                    # <-- CHANGE TO NEW_PROJECT_ID
  GAR_LOCATION: us-central1
  SERVICE: door-quoter-app
  REGION: us-central1

jobs:
  deploy:
    permissions:
      contents: read
      id-token: write

    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Google Auth
        id: auth
        uses: 'google-github-actions/auth@v2'
        with:
          credentials_json: '${{ secrets.GCP_SA_KEY }}'

      - name: 'Set up Cloud SDK'
        uses: 'google-github-actions/setup-gcloud@v2'
        with:
          project_id: ${{ env.PROJECT_ID }}

      - name: 'Use gcloud CLI'
        run: 'gcloud info'

      - name: 'Docker auth'
        run: |-
          gcloud auth configure-docker ${{ env.GAR_LOCATION }}-docker.pkg.dev --quiet

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Build and Push Container
        run: |-
          docker build -t "us-central1-docker.pkg.dev/door-quoter/door-quoter-app/door-quoter-app:production-latest" ./
          docker push "us-central1-docker.pkg.dev/door-quoter/door-quoter-app/door-quoter-app:production-latest"
          # ^^ CHANGE door-quoter to NEW_PROJECT_ID in both lines ^^

      - name: Deploy to Cloud Run
        id: deploy
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ${{ env.SERVICE }}
          region: ${{ env.REGION }}
          image: us-central1-docker.pkg.dev/door-quoter/door-quoter-app/door-quoter-app:production-latest
          # ^^ CHANGE door-quoter to NEW_PROJECT_ID ^^
          env_vars: |
            DATABASE_URL=postgresql://postgres:SimplePass123@localhost/door_quoter?host=/cloudsql/door-quoter:us-central1:door-app-db
            NEXTAUTH_URL=${{ secrets.NEXTAUTH_URL }}
            NEXTAUTH_SECRET=${{ secrets.NEXTAUTH_SECRET }}
            NODE_ENV=production
            # ^^ DATABASE_URL: Change door-quoter to NEW_PROJECT_ID, update password if changed ^^

      - name: Show Output
        run: echo ${{ steps.deploy.outputs.url }}
```

**Lines to change:**
| Line | Current | Change To |
|------|---------|-----------|
| 8 | `PROJECT_ID: door-quoter` | `PROJECT_ID: NEW_PROJECT_ID` |
| 49 | `us-central1-docker.pkg.dev/door-quoter/door-quoter-app/...` | `us-central1-docker.pkg.dev/NEW_PROJECT_ID/door-quoter-app/...` |
| 50 | Same as above | Same pattern |
| 59 | Same as above | Same pattern |
| 61 | `host=/cloudsql/door-quoter:us-central1:door-app-db` | `host=/cloudsql/NEW_PROJECT_ID:us-central1:door-app-db` |
| 61 | `SimplePass123` | `NEW_PROD_PASSWORD` (if changed) |

---

### 3. `start-proxy.sh`

**Current content:**

```bash
#!/bin/bash

# Check if Cloud SQL proxy is already running on port 5432
if ! ss -tlnp | grep -q ':5432 '; then
    echo '🔄 Starting Cloud SQL proxy...'

    # Start the proxy in background
    nohup ~/cloud_sql_proxy -instances=door-quoter:us-central1:door-app-staging=tcp:5432 > proxy.log 2>&1 &
    # ^^ CHANGE door-quoter to NEW_PROJECT_ID ^^

    # Wait a moment for it to start
    sleep 3

    # Verify it started
    if ss -tlnp | grep -q ':5432 '; then
        echo '✅ Cloud SQL proxy started successfully on port 5432'
    else
        echo '❌ Failed to start Cloud SQL proxy'
        echo 'Check proxy.log for details:'
        tail -5 proxy.log
        exit 1
    fi
else
    echo '✅ Cloud SQL proxy already running on port 5432'
fi
```

**Line to change:**
| Line | Current | Change To |
|------|---------|-----------|
| 8 | `door-quoter:us-central1:door-app-staging` | `NEW_PROJECT_ID:us-central1:door-app-staging` |

---

### 4. `DEPLOYMENT_GUIDE.md`

**Sections to update:**

1. **Environment URLs table (lines 17-21):** Update Cloud Run URLs after first deployment
2. **GitHub Actions URL (line 200):** Update org/repo if changed
3. **Cloud SQL Instances reference (lines 159-160):** Update if instance names change
4. **Service Account (line 162):** `github-actions@NEW_PROJECT_ID.iam.gserviceaccount.com`
5. **Database passwords (lines 186-187, 269-272, 317-332):** Update if passwords change
6. **gcloud commands (lines 207-222, 257-272):** Update service names if changed

---

### 5. `.github/workflows/ci.yml`

**No changes needed** - Uses local postgres container for CI tests, no GCP references.

---

## Values Needed for Migration

Fill in these values before implementing:

```
NEW_PROJECT_ID: ________________
NEW_STAGING_DB_PASSWORD: ________________ (or keep: StagingDB123)
NEW_PROD_DB_PASSWORD: ________________ (or keep: SimplePass123)
CUSTOM_DOMAIN: ________________ (if using custom domain instead of .run.app URLs)
NEW_GCS_BUCKET: ________________ (if using cloud storage)
```

---

## GitHub Secrets to Update

After creating the new service account in GCP:

| Secret | Action |
|--------|--------|
| `GCP_SA_KEY` | Replace with new service account JSON key |
| `NEXTAUTH_URL` | Update if domain changes (otherwise keep same) |
| `NEXTAUTH_SECRET` | Keep same (no reason to change) |

---

## Migration Phases

### Phase 1: GCP Account & Project Setup (Manual - GCP Console)

#### Step 1.1: Create Business GCP Account
1. Go to https://console.cloud.google.com
2. Sign in with your business Google account (or create one)
3. If prompted, set up billing:
   - Click "Billing" in the left menu
   - Click "Link a billing account" or "Create account"
   - Add business payment method (credit card or invoice)
   - Name it something like "Sympateco Billing"

#### Step 1.2: Create New GCP Project
1. Click the project dropdown at the top of the console
2. Click "New Project"
3. **Project name:** `door-quoter-prod` (or your preferred name)
4. **Organization:** Select your organization if available (or "No organization")
5. **Location:** Select organization or folder
6. Click "Create"
7. Wait for project creation (takes ~30 seconds)
8. **IMPORTANT:** Note the Project ID (may differ from name if name is taken)

#### Step 1.3: Enable Required APIs
1. Go to: APIs & Services > Library
2. Search for and enable each of these APIs:
   - **Cloud Run Admin API** - for deploying containers
   - **Cloud SQL Admin API** - for database management
   - **Artifact Registry API** - for storing Docker images
   - **Cloud Build API** - for building containers
   - **Cloud Storage API** - for file uploads (if used)
   - **Secret Manager API** - for secrets (optional)
   - **Compute Engine API** - required by Cloud SQL

Or use gcloud CLI:
```bash
gcloud config set project NEW_PROJECT_ID

gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com
```

#### Step 1.4: Create Artifact Registry Repository
1. Go to: Artifact Registry > Repositories
2. Click "Create Repository"
3. Configure:
   - **Name:** `door-quoter-app`
   - **Format:** Docker
   - **Mode:** Standard
   - **Location type:** Region
   - **Region:** `us-central1`
   - **Encryption:** Google-managed encryption key
4. Click "Create"

Or use gcloud CLI:
```bash
gcloud artifacts repositories create door-quoter-app \
  --repository-format=docker \
  --location=us-central1 \
  --description="Door Quoter application images"
```

#### Step 1.5: Create Cloud SQL Instances

##### Staging Database Instance
1. Go to: SQL > Create Instance
2. Choose **PostgreSQL**
3. Click "Create Instance"
4. Configure:
   - **Instance ID:** `door-app-staging`
   - **Password:** Set a strong password (save this!)
   - **Database version:** PostgreSQL 15 (or 16)
   - **Cloud SQL edition:** Enterprise
   - **Preset:** Development (cost-effective for staging)
   - **Region:** `us-central1`
   - **Zonal availability:** Single zone (fine for staging)
5. Expand "Show Configuration Options":
   - **Machine configuration:**
     - Machine type: `db-f1-micro` (1 shared vCPU, 0.6 GB) for staging
     - Or `db-g1-small` (1 shared vCPU, 1.7 GB) for better performance
   - **Storage:**
     - Storage type: SSD
     - Storage capacity: 10 GB (can auto-increase)
     - Enable automatic storage increases: Yes
   - **Connections:**
     - Private IP: Not required (using Cloud SQL Proxy)
     - Public IP: Enable (required for Cloud SQL Proxy)
   - **Data Protection:**
     - Automate backups: Enable
     - Enable point-in-time recovery: Yes (recommended)
   - **Maintenance:**
     - Maintenance window: Any (or pick low-traffic time)
6. Click "Create Instance" (takes 5-10 minutes)

7. **After instance is created:**
   - Click on the instance
   - Go to "Databases" tab
   - Click "Create Database"
   - Database name: `postgres` (already exists by default, skip this)
   - The staging environment uses the default `postgres` database

##### Production Database Instance
1. Go to: SQL > Create Instance
2. Choose **PostgreSQL**
3. Configure:
   - **Instance ID:** `door-app-db`
   - **Password:** Set a DIFFERENT strong password (save this!)
   - **Database version:** PostgreSQL 15 (or 16)
   - **Cloud SQL edition:** Enterprise
   - **Preset:** Production (or customize)
   - **Region:** `us-central1`
   - **Zonal availability:** Multiple zones (recommended for production)
4. Expand "Show Configuration Options":
   - **Machine configuration:**
     - Machine type: `db-custom-1-3840` (1 vCPU, 3.75 GB) minimum for production
     - Or `db-custom-2-7680` (2 vCPU, 7.5 GB) for better performance
   - **Storage:**
     - Storage type: SSD
     - Storage capacity: 20 GB (or more based on data size)
     - Enable automatic storage increases: Yes
   - **Connections:**
     - Public IP: Enable
   - **Data Protection:**
     - Automate backups: Enable (daily)
     - Enable point-in-time recovery: Yes
     - Backup retention: 7 days minimum
   - **Flags (optional):**
     - Consider adding: `log_min_duration_statement=1000` for slow query logging
5. Click "Create Instance" (takes 5-10 minutes)

6. **After instance is created:**
   - Click on the instance
   - Go to "Databases" tab
   - Click "Create Database"
   - Database name: `door_quoter`
   - Click "Create"

Or use gcloud CLI:
```bash
# Staging instance
gcloud sql instances create door-app-staging \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=04:00 \
  --availability-type=zonal

# Set staging password
gcloud sql users set-password postgres \
  --instance=door-app-staging \
  --password=YOUR_STAGING_PASSWORD

# Production instance
gcloud sql instances create door-app-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-1-3840 \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=20GB \
  --storage-auto-increase \
  --backup-start-time=04:00 \
  --availability-type=regional

# Set production password
gcloud sql users set-password postgres \
  --instance=door-app-db \
  --password=YOUR_PRODUCTION_PASSWORD

# Create production database
gcloud sql databases create door_quoter --instance=door-app-db
```

#### Step 1.6: Create GCS Bucket (if using file uploads)
1. Go to: Cloud Storage > Buckets
2. Click "Create"
3. Configure:
   - **Name:** `sympateco-door-quoter-uploads` (must be globally unique)
   - **Location type:** Region
   - **Location:** `us-central1`
   - **Storage class:** Standard
   - **Access control:** Uniform (recommended)
   - **Protection:** None (or add if needed)
4. Click "Create"

5. **Set CORS (if direct browser uploads):**
```bash
# Create cors.json file:
cat > cors.json << 'EOF'
[
  {
    "origin": ["*"],
    "method": ["GET", "PUT", "POST"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

# Apply CORS configuration
gsutil cors set cors.json gs://YOUR_BUCKET_NAME
```

#### Step 1.7: Create Service Account for GitHub Actions
1. Go to: IAM & Admin > Service Accounts
2. Click "Create Service Account"
3. Configure:
   - **Service account name:** `github-actions`
   - **Service account ID:** `github-actions` (auto-filled)
   - **Description:** "Service account for GitHub Actions CI/CD"
4. Click "Create and Continue"
5. **Grant roles** (click "Add Another Role" for each):
   - `Cloud Run Admin` (roles/run.admin)
   - `Artifact Registry Writer` (roles/artifactregistry.writer)
   - `Cloud SQL Client` (roles/cloudsql.client)
   - `Storage Admin` (roles/storage.admin) - if using GCS
   - `Service Account User` (roles/iam.serviceAccountUser)
6. Click "Continue"
7. Click "Done"

8. **Generate JSON Key:**
   - Click on the newly created service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose "JSON"
   - Click "Create"
   - **SAVE THIS FILE SECURELY** - this is your `GCP_SA_KEY`

Or use gcloud CLI:
```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions" \
  --description="Service account for GitHub Actions CI/CD"

# Grant roles
PROJECT_ID=$(gcloud config get-value project)

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Generate key file
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@${PROJECT_ID}.iam.gserviceaccount.com

echo "Key saved to github-actions-key.json - add this to GitHub Secrets as GCP_SA_KEY"
```

#### Step 1.8: Cloud Run Services (Auto-Created)
Cloud Run services will be automatically created on first deployment via GitHub Actions. No manual setup needed.

If you want to pre-create them:
1. Go to: Cloud Run
2. Click "Create Service"
3. Select "Deploy one revision from an existing container image"
4. Use placeholder: `gcr.io/cloudrun/hello`
5. Configure:
   - **Service name:** `door-quoter-staging` (or `door-quoter-app` for prod)
   - **Region:** `us-central1`
   - **Authentication:** Allow unauthenticated invocations
6. Expand "Container, Networking, Security":
   - **Cloud SQL connections:** Add your Cloud SQL instance
7. Click "Create"

---

### Phase 1 Checklist Summary
- [ ] Business GCP account created with billing
- [ ] New project created: `________________` (fill in Project ID)
- [ ] All APIs enabled (Cloud Run, Cloud SQL, Artifact Registry, Cloud Build, Storage)
- [ ] Artifact Registry repository created: `door-quoter-app`
- [ ] Cloud SQL staging instance created: `door-app-staging`
  - [ ] Password set: `________________`
- [ ] Cloud SQL production instance created: `door-app-db`
  - [ ] Password set: `________________`
  - [ ] Database `door_quoter` created
- [ ] GCS bucket created (if needed): `________________`
- [ ] Service account created: `github-actions@PROJECT_ID.iam.gserviceaccount.com`
- [ ] Service account roles granted
- [ ] JSON key downloaded and saved securely

---

### Phase 2: Database Migration
```bash
# Export from OLD project
~/cloud_sql_proxy -instances=door-quoter:us-central1:door-app-staging=tcp:5432 &
pg_dump -h 127.0.0.1 -U postgres -d postgres -F c -f staging_export.dump

~/cloud_sql_proxy -instances=door-quoter:us-central1:door-app-db=tcp:5433 &
pg_dump -h 127.0.0.1 -U postgres -d door_quoter -F c -f production_export.dump

# Import to NEW project
~/cloud_sql_proxy -instances=NEW_PROJECT_ID:us-central1:door-app-staging=tcp:5432 &
pg_restore -h 127.0.0.1 -U postgres -d postgres -F c staging_export.dump

~/cloud_sql_proxy -instances=NEW_PROJECT_ID:us-central1:door-app-db=tcp:5433 &
pg_restore -h 127.0.0.1 -U postgres -d door_quoter -F c production_export.dump
```

### Phase 3: Update Code Files
Once you have `NEW_PROJECT_ID`, update these files:
1. `.github/workflows/deploy-staging.yml`
2. `.github/workflows/deploy-production.yml`
3. `start-proxy.sh`
4. `DEPLOYMENT_GUIDE.md`

### Phase 4: Update GitHub Secrets
1. Go to: `https://github.com/sympatecoinc/Door-Quoter/settings/secrets/actions`
2. Update `GCP_SA_KEY` with new service account JSON
3. Update `NEXTAUTH_URL` if domain changes

### Phase 5: Test Deployments
1. Push to `staging` branch - verify workflow succeeds
2. Test staging app functionality
3. Push to `main` branch - verify workflow succeeds
4. Test production app functionality

### Phase 6: Domain Migration (if using custom domain via GoDaddy)
1. In new GCP Console > Cloud Run > Manage Custom Domains
2. Add domain mapping for production service
3. Update GoDaddy DNS records as specified by Cloud Run
4. Wait for DNS propagation
5. Verify HTTPS works

### Phase 7: Cleanup Old Project
- [ ] Keep old project running 1-2 weeks as fallback
- [ ] After validation, disable old Cloud Run services
- [ ] Delete old Cloud SQL instances (after confirming backups)
- [ ] Close old billing account

---

## Quick Find-Replace Commands

Once you have `NEW_PROJECT_ID`, you can use these sed commands:

```bash
# Preview changes (dry run)
grep -r "door-quoter" .github/workflows/ start-proxy.sh

# Replace in workflow files
sed -i 's/door-quoter/NEW_PROJECT_ID/g' .github/workflows/deploy-staging.yml
sed -i 's/door-quoter/NEW_PROJECT_ID/g' .github/workflows/deploy-production.yml
sed -i 's/door-quoter/NEW_PROJECT_ID/g' start-proxy.sh

# Note: DEPLOYMENT_GUIDE.md should be updated manually as it has more context
```

---

## Verification Checklist

After migration, verify:
- [ ] `git push origin staging` triggers successful deployment
- [ ] Staging app loads at new URL
- [ ] Staging database connection works
- [ ] `git push origin main` triggers successful deployment
- [ ] Production app loads at new URL
- [ ] Production database connection works
- [ ] User authentication works (NextAuth)
- [ ] All existing data is present in both databases
- [ ] Custom domain resolves correctly (if applicable)
- [ ] HTTPS/SSL working

---

## Rollback Plan

If migration fails:
1. Revert code changes: `git revert HEAD`
2. Restore old `GCP_SA_KEY` in GitHub Secrets
3. Old Cloud Run services should still be running
4. DNS can be pointed back to old project

---

**Created:** 2026-01-26
**Author:** Claude Code
**Status:** Ready for implementation
