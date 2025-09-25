# Door Quoter - Quick Reference

## 🚀 **Deployment Commands**

```bash
# Deploy to Staging
git push origin develop

# Deploy to Production  
git push origin main
```

## 🌍 **Environment URLs**

- **Local**: http://localhost:3000
- **Staging**: https://door-quoter-staging-259524707165.us-central1.run.app
- **Production**: https://door-quoter-app-259524707165.us-central1.run.app

## 🛠️ **Local Development**

```bash
# Start development
cd ~/projects/Door-Quoter
npm run dev

# Database connection test
export PGPASSWORD='StagingDB123'
psql -h localhost -p 5432 -U postgres -d postgres -c "SELECT COUNT(*) FROM \"Projects\";"
```

## 📊 **Monitoring**

- **GitHub Actions**: https://github.com/sympatecoinc/Door-Quoter/actions
- **Cloud Run Services**: 
  ```bash
  gcloud run services list --region=us-central1
  ```

## 🔐 **Database Passwords**

- **Staging**: `StagingDB123`
- **Production**: `SimplePass123`

## ⚡ **Emergency Commands**

```bash
# Restart local proxy
cd ~/projects/Door-Quoter && ./start-proxy.sh

# Kill port 3000
lsof -ti:3000 | xargs kill -9

# Check deployment logs
gcloud logging read "resource.labels.service_name=door-quoter-app" --limit=10
```