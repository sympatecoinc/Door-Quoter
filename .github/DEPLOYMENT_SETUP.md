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
gcloud projects add-iam-policy-binding door-quoter \
    --member="serviceAccount:github-actions@door-quoter.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding door-quoter \
    --member="serviceAccount:github-actions@door-quoter.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding door-quoter \
    --member="serviceAccount:github-actions@door-quoter.iam.gserviceaccount.com" \
    --role="roles/artifactregistry.writer"

# Create and download key
gcloud iam service-accounts keys create github-actions-key.json \
    --iam-account=github-actions@door-quoter.iam.gserviceaccount.com
```

**GitHub Secret**: `GCP_SA_KEY` = Contents of `github-actions-key.json`

### 2. Database URLs

**Production**:
- `DATABASE_URL` = `postgresql://postgres:YOUR_PASSWORD@/door_quoter?host=/cloudsql/door-quoter:us-central1:door-app-db`

**Staging**:  
- `STAGING_DATABASE_URL` = `postgresql://postgres:staging123@/postgres?host=/cloudsql/door-quoter:us-central1:door-app-staging`

### 3. NextAuth Configuration

- `NEXTAUTH_SECRET` = Generate with: `openssl rand -base64 32`
- `NEXTAUTH_URL` = Your production URL (e.g., `https://door-quoter-app-xyz.a.run.app`)
- `STAGING_NEXTAUTH_URL` = Your staging URL (e.g., `https://door-quoter-staging-xyz.a.run.app`)

## Workflows

### CI Workflow (`.github/workflows/ci.yml`)
- Runs on: Push to main/develop, Pull requests
- Actions: Lint, type check, build, test with PostgreSQL

### Production Deployment (`.github/workflows/deploy.yml`)
- Runs on: Push to main branch
- Deploys to: `door-quoter-app` Cloud Run service

### Staging Deployment (`.github/workflows/deploy-staging.yml`)
- Runs on: Push to develop branch, Pull requests to main
- Deploys to: `door-quoter-staging` Cloud Run service

## Artifact Registry

Images are stored in:
- Production: `us-central1-docker.pkg.dev/door-quoter/door-quoter-app`
- Staging: `us-central1-docker.pkg.dev/door-quoter/door-quoter-staging`
