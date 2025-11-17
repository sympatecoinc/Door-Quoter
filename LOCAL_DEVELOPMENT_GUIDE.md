# Local Development Setup Guide

## Overview

You are now set up to develop **locally on your Mac** using Dev Containers, which eliminates the need for the expensive Google Cloud VM for development.

### What Changed

**Before:**
- VS Code Remote SSH to Google Cloud VM
- Development on VM (costing ~$113/month)
- VM crashes lose work
- Network latency

**After:**
- Development on your Mac (no VM cost)
- Faster, more stable
- Dev Container provides identical environment
- Work saved locally, instant commits

---

## Initial Setup (One-Time)

### Step 1: Open Project in VS Code

```bash
code ~/projects/Door-Quoter
```

### Step 2: Reopen in Container

When VS Code opens, you should see a popup in the bottom-right:

> **"Folder contains a Dev Container configuration file. Reopen in Container?"**

Click **"Reopen in Container"**

**OR** manually:
1. Press `Cmd+Shift+P`
2. Type: "Dev Containers: Reopen in Container"
3. Press Enter

### Step 3: Wait for Build (First Time Only)

The first time will take 3-5 minutes:
- Downloads Node.js 20 image
- Installs system dependencies
- Sets up PostgreSQL
- Runs `npm install`
- Runs `prisma generate`

You'll see progress in VS Code.

### Step 4: Create .env.local File

```bash
# Copy the example file
cp .env.local.example .env.local

# Edit it if needed (optional - defaults work for local dev)
```

### Step 5: Set Up Database

```bash
# Run Prisma migrations to create tables
npx prisma migrate dev

# (Optional) Seed database if you have a seed script
# npm run seed
```

### Step 6: Start Development Server

```bash
npm run dev
```

**Access your app at:** http://localhost:3000

---

## Daily Workflow

### Starting Work

```bash
# 1. Open VS Code
code ~/projects/Door-Quoter

# 2. Reopen in Container (if not automatic)
# Cmd+Shift+P → "Dev Containers: Reopen in Container"

# 3. Start dev server
npm run dev

# 4. Open http://localhost:3000
```

### Making Changes

1. Edit files in VS Code (they're synced to container automatically)
2. Changes hot-reload instantly
3. Test in browser at localhost:3000
4. Use Claude Code normally (it runs on your Mac, edits files on Mac)

### Database Operations

```bash
# View database in Prisma Studio
npx prisma studio

# Create a new migration after schema changes
npx prisma migrate dev --name describe_your_change

# Reset database (careful - deletes all data)
npx prisma migrate reset
```

---

## Deployment Workflow

### Deploy to Staging

```bash
# 1. Commit your changes
git add .
git commit -m "Your commit message"

# 2. Push to staging branch
git push origin staging

# 3. GitHub Actions automatically deploys to Cloud Run staging
# Check: https://github.com/sympatecoinc/Door-Quoter/actions
```

**Staging URL:** https://door-quoter-staging-259524707165.us-central1.run.app

### Deploy to Production

```bash
# 1. Merge staging to main (after testing)
git checkout main
git merge staging

# 2. Push to main
git push origin main

# 3. GitHub Actions automatically deploys to Cloud Run production
```

**Production URL:** (Your production Cloud Run URL)

---

## Connecting to Cloud SQL (Optional)

When you need to test with **real staging data** instead of local database:

### Step 1: Run Cloud SQL Proxy on Your Mac

```bash
# In a separate terminal ON YOUR MAC (not in container)
cloud-sql-proxy door-quoter:us-central1:door-app-staging --port=5433
```

### Step 2: Update .env.local

```env
# Comment out local database
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/door_quoter_dev"

# Use Cloud SQL via proxy
DATABASE_URL="postgresql://postgres:StagingDB123@host.docker.internal:5433/postgres"
```

### Step 3: Restart Dev Server

```bash
npm run dev
```

---

## Troubleshooting

### Container Won't Build

```bash
# Rebuild container from scratch
Cmd+Shift+P → "Dev Containers: Rebuild Container"
```

### Database Connection Error

```bash
# Check if Postgres is running
docker ps | grep postgres

# Restart containers
Cmd+Shift+P → "Dev Containers: Rebuild Container"
```

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or change port in package.json dev script:
# "dev": "next dev -p 3001"
```

### Node Modules Issues

```bash
# Inside container terminal:
rm -rf node_modules package-lock.json
npm install
```

---

## What About the VM?

### Keep It For:
- ✅ Long-running batch jobs
- ✅ Testing deployment configurations
- ✅ CI/CD runners (if needed)
- ✅ Production-like environment testing

### Don't Use It For:
- ❌ Daily development
- ❌ Code editing
- ❌ Testing features
- ❌ Database development

### Cost Savings:
- **Before:** ~$180/month (VM + SQL + Cloud Run)
- **After:** ~$65/month (SQL + Cloud Run only)
- **Savings:** ~$115/month

You can **downsize or stop the VM** when not needed.

---

## Architecture Diagram

```
┌─────────────────────────────────────┐
│         Your Mac                    │
│  ┌──────────────────────────────┐   │
│  │  VS Code + Claude Code       │   │
│  └──────────────────────────────┘   │
│              │                       │
│              ↓                       │
│  ┌──────────────────────────────┐   │
│  │  Docker Container            │   │
│  │  ├─ Node.js 20               │   │
│  │  ├─ Next.js Dev Server       │   │
│  │  ├─ PostgreSQL 15            │   │
│  │  └─ Your Code (synced)       │   │
│  └──────────────────────────────┘   │
│              ↓                       │
│        localhost:3000                │
└─────────────────────────────────────┘
              │
              ↓ (git push)
     ┌────────────────────┐
     │  GitHub Actions    │
     └────────────────────┘
              │
              ↓
     ┌────────────────────┐
     │  Cloud Run         │
     │  (Staging/Prod)    │
     └────────────────────┘
              │
              ↓
     ┌────────────────────┐
     │  Cloud SQL         │
     │  (PostgreSQL)      │
     └────────────────────┘
```

---

## Tips & Best Practices

### 1. Use Git Branches

```bash
# Create feature branch
git checkout -b feature/new-feature

# Work on feature locally
# Push to GitHub
git push origin feature/new-feature

# Merge to staging when ready
git checkout staging
git merge feature/new-feature
git push origin staging
```

### 2. Database Migrations

Always create migrations for schema changes:

```bash
# After editing schema.prisma
npx prisma migrate dev --name add_new_field

# Commit the migration files
git add prisma/migrations/
git commit -m "Add migration for new field"
```

### 3. Environment Variables

- **Local dev:** `.env.local` (not committed to git)
- **Staging:** Set in GitHub Actions workflow
- **Production:** Set in GitHub Actions workflow (use secrets)

### 4. Testing Before Deploy

```bash
# Test build locally
npm run build

# Test production mode locally
npm run build && npm start
```

---

## Next Steps

1. ✅ Open project: `code ~/projects/Door-Quoter`
2. ✅ Reopen in Container
3. ✅ Run: `npx prisma migrate dev`
4. ✅ Run: `npm run dev`
5. ✅ Open: http://localhost:3000
6. ✅ Start coding!

---

## Questions?

- **VS Code not detecting container?** Make sure Docker Desktop is running
- **Can't connect to database?** Check if PostgreSQL container is running: `docker ps`
- **Want to use Cloud SQL?** See "Connecting to Cloud SQL" section above
- **Deploy not working?** Check GitHub Actions tab for errors

**You're all set! Happy coding! 🚀**
