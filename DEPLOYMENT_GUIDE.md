# Door Quoter Deployment Guide

## 🏗️ Architecture Overview

Your application uses a **3-tier deployment architecture**:

```
Local Dev → Staging → Production
    ↓         ↓         ↓
Staging DB → Staging DB → Production DB
```

## 🌍 Environment URLs

| Environment | URL | Database |
|-------------|-----|----------|
| **Local Dev** | http://localhost:3000 | door-app-staging (postgres) |
| **Staging** | https://door-quoter-staging-259524707165.us-central1.run.app | door-app-staging (postgres) |
| **Production** | https://door-quoter-app-259524707165.us-central1.run.app | door-app-db (door_quoter) |

## 🚀 Deployment Workflow
```bash

# Use dev branch for safe testing, commits, rollback practice
git checkout dev
git add .
git commit -m "Test changes"
git push origin dev

THEN:

  git checkout staging
  git merge dev
  git push origin staging

THEN:

  git checkout main
  git merge staging
  git push origin main

```
### **Step 1: Local Development**
```bash
# Start local development (on VM)
cd ~/projects/Door-Quoter
npm run dev  # Automatically starts Cloud SQL proxy + Next.js server
```
- **Port**: 3000
- **Database**: Connected via Cloud SQL proxy to staging database
- **Data**: Shared with staging environment

### **Step 2: Safe Testing & Development**
```bash
# Use dev branch for safe testing, commits, rollback practice
git checkout dev
git add .
git commit -m "Test changes"
git push origin dev

# To rollback to previous commit (hard reset - discards changes)
git reset --hard HEAD~1

# To rollback to previous commit (soft reset - keeps changes staged)
git reset --soft HEAD~1

# To rollback to a specific commit (hard reset - discards changes)
git reset --hard <commit-hash>

# To rollback to a specific commit (soft reset - keeps changes staged)
git reset --soft <commit-hash>

# View recent commits with messages
git log --oneline -10

# View commit history with details
git log --graph --pretty=format:'%h -%d %s (%cr) <%an>' --abbrev-commit -10
```
- **Trigger**: No deployments triggered
- **Purpose**: Safe branch for commits, rollback testing, and development work
- **Result**: No infrastructure changes
- **Rollback**: Use `git reset --hard HEAD~1` to restore from previous commit

### **⚠️ IMPORTANT: Preventing Branch Conflicts**

1. **Always pull before making changes:**
```bash
git pull origin <branch-name>
```

2. **Use this safe workflow for any branch:**
```bash
# Check current branch
git branch

# Switch branches cleanly
git checkout <target-branch>
git pull origin <target-branch>

# Make your changes, then:
git add .
git commit -m "Your message"
git push origin <target-branch>
```


### **Step 3: Deploy to Staging**
```bash
# Push to staging branch
git checkout staging
git add .
git commit -m "Your changes"
git push origin staging
```
- **Trigger**: Push to `staging` branch
- **Deployment**: Automatic via GitHub Actions
- **Result**: Updates staging environment
- **Test**: https://door-quoter-staging-259524707165.us-central1.run.app

### **Step 4: Deploy to Production**
```bash
# Push to main branch
git checkout main
git merge staging  # or your feature branch
git push origin main
```
- **Trigger**: Push to `main` branch
- **Deployment**: Automatic via GitHub Actions  
- **Result**: Updates production environment
- **Result**: https://door-quoter-app-259524707165.us-central1.run.app

## 📋 Prerequisites Checklist

### **GitHub Secrets** (Already Configured ✅)
| Secret Name | Purpose | Status |
|-------------|---------|---------|
| `GCP_SA_KEY` | Google Cloud authentication | ✅ Set |
| `NEXTAUTH_URL` | Production authentication URL | ✅ Set |
| `NEXTAUTH_SECRET` | Production auth secret | ✅ Set |

### **Google Cloud Resources** (Already Configured ✅)
- **Cloud SQL Instances**: door-app-staging, door-app-db
- **Cloud Run Services**: door-quoter-staging, door-quoter-app
- **Artifact Registry**: door-quoter-app repository
- **Service Account**: github-actions@door-quoter.iam.gserviceaccount.com

## 🛠️ Development Commands

### **Local Development**
```bash
# Start development server
npm run dev

# Run migrations (if needed)
npx prisma db push

# Generate Prisma client
npx prisma generate

# View database
npx prisma studio
```

### **Database Management**
```bash
# Connect to staging database (local)
export PGPASSWORD='StagingDB123'
psql -h localhost -p 5432 -U postgres -d postgres

# View tables
\dt

# Check data
SELECT COUNT(*) FROM "Projects";
```

## 📊 Monitoring & Logs

### **GitHub Actions**
- **Monitor deployments**: https://github.com/sympatecoinc/Door-Quoter/actions
- **Staging workflow**: Deploy to Staging
- **Production workflow**: Deploy to Production

### **Google Cloud Logs**
```bash
# Staging logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=door-quoter-staging" --limit=20

# Production logs  
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=door-quoter-app" --limit=20
```

### **Cloud Run Status**
```bash
# List services
gcloud run services list --region=us-central1

# Describe service
gcloud run services describe door-quoter-app --region=us-central1
```

## 🚨 Troubleshooting

### **Local Development Issues**

**Issue**: "Can't reach database server"
```bash
# Check proxy status
ps aux | grep cloud_sql_proxy

# Restart proxy if needed
cd ~/projects/Door-Quoter
./start-proxy.sh
```

**Issue**: "Port 3000 already in use"
```bash
# Kill existing processes
lsof -ti:3000 | xargs kill -9
```

### **Deployment Issues**

**Issue**: GitHub Actions failing
1. Check workflow logs at https://github.com/sympatecoinc/Door-Quoter/actions
2. Verify all GitHub secrets are set
3. Check Google Cloud service account permissions

**Issue**: Database connection errors in production
```bash
# Check Cloud Run environment variables
gcloud run services describe door-quoter-app --region=us-central1 --format="export" | grep DATABASE_URL

# Check Cloud SQL instance status
gcloud sql instances list
```

### **Database Issues**

**Issue**: "Authentication failed"
```bash
# Reset database passwords if needed
gcloud sql users set-password postgres --instance=door-app-staging --password=StagingDB123
gcloud sql users set-password postgres --instance=door-app-db --password=SimplePass123
```

## 🔄 Common Workflows

### **Feature Development**
1. Work locally on your feature
2. Test locally against staging database
3. Push to `staging` branch
4. Test on staging environment
5. Merge to `main` for production deployment

### **Hotfix Deployment**
1. Create hotfix branch from `main`
2. Make urgent changes
3. Test locally
4. Push directly to `main` (skip staging if urgent)

### **Database Schema Changes**
1. Update Prisma schema locally
2. Run `npx prisma db push` locally first
3. Test locally
4. Deploy to staging to test migration
5. Deploy to production

## 📞 Support Information

### **Key File Locations**
- **Workflows**: `.github/workflows/`
- **Environment**: `.env.local` (local dev only)
- **Database Schema**: `prisma/schema.prisma`
- **Proxy Script**: `start-proxy.sh`

### **Important Commands to Remember**
- **Start local dev**: `npm run dev`
- **Deploy staging**: `git push origin staging` 
- **Deploy production**: `git push origin main`
- **View logs**: Use GitHub Actions or `gcloud logging read`

## 🔐 Database Credentials Reference

### **Staging Database** (`door-app-staging`)
- **Host**: Via Cloud SQL proxy (localhost:5432) or direct connection
- **Database**: `postgres`
- **User**: `postgres`  
- **Password**: `StagingDB123`
- **Used by**: Local development + Staging Cloud Run

### **Production Database** (`door-app-db`)
- **Host**: Via Cloud SQL connection
- **Database**: `door_quoter`
- **User**: `postgres`
- **Password**: `SimplePass123`
- **Used by**: Production Cloud Run only

---

**Last Updated**: December 2024
**Architecture**: 3-tier (Local → Staging → Production)
**Status**: ✅ All environments operational