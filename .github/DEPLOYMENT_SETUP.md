# GitHub Actions Deployment Setup

## Required GitHub Secrets

To enable automated deployment, you need to configure the following secrets in your GitHub repository:

### 1. Google Cloud Service Account Key

Create a service account and download the key:

```bash
# Create service account
gcloud iam service-accounts create github-actions \
    --description="Service account for GitHub Actions" \
    --display-name="GitHub Actions"

# Add required roles
gcloud projects add-iam-policy-binding linea-door-quoter \
    --member="serviceAccount:github-actions@linea-door-quoter.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding linea-door-quoter \
    --member="serviceAccount:github-actions@linea-door-quoter.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding linea-door-quoter \
    --member="serviceAccount:github-actions@linea-door-quoter.iam.gserviceaccount.com" \
    --role="roles/artifactregistry.writer"

# Create and download key
gcloud iam service-accounts keys create github-actions-key.json \
    --iam-account=github-actions@linea-door-quoter.iam.gserviceaccount.com
```

**GitHub Secret**: `GCP_SA_KEY` = Contents of `github-actions-key.json`

### 2. Database URLs

**Production**:
- `DATABASE_URL` = `postgresql://postgres:YOUR_PASSWORD@/door_quoter?host=/cloudsql/linea-door-quoter:us-central1:door-app-db`

**Staging**:
- `STAGING_DATABASE_URL` = `postgresql://postgres:staging123@/postgres?host=/cloudsql/linea-door-quoter:us-central1:door-app-staging`

### 3. NextAuth Configuration

- `NEXTAUTH_SECRET` = Generate with: `openssl rand -base64 32`
- `NEXTAUTH_URL` = Your production URL (e.g., `https://door-quoter-app-419240735293.us-central1.run.app`)
- `STAGING_NEXTAUTH_URL` = Your staging URL (e.g., `https://door-quoter-staging-419240735293.us-central1.run.app`)

## Workflows

### CI Workflow (`.github/workflows/ci.yml`)
- Runs on: Push to main/develop, Pull requests
- Actions: Lint, type check, build, test with PostgreSQL

### Production Deployment (`.github/workflows/deploy-production.yml`)
- Runs on: Push to main branch
- Deploys to: `door-quoter-app` Cloud Run service

### Staging Deployment (`.github/workflows/deploy-staging.yml`)
- Runs on: Push to staging branch, Pull requests to main
- Deploys to: `door-quoter-staging` Cloud Run service

## Artifact Registry

Images are stored in:
- `us-central1-docker.pkg.dev/linea-door-quoter/door-quoter-app`

## Cloud SQL Instances

- **Staging**: `linea-door-quoter:us-central1:door-app-staging`
- **Production**: `linea-door-quoter:us-central1:door-app-db`

## GCS Bucket

- `linea-door-quoter-uploads` - Used for file storage (logos, attachments)
