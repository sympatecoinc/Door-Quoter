# Development Workflow Guide

## The Problem You Noticed
✅ **SOLVED**: The issue was stale build artifacts in `.next/` folder causing module conflicts.

## Clean Development Process

### 1. **Starting Fresh Development**
```bash
# Clean any build issues
rm -rf .next node_modules/.cache
npm install

# Start development server (background mode)
npm run dev > server.log 2>&1 & echo $! > server.pid
echo "Server started! Check http://localhost:3000"

# Check server status
ps -p $(cat server.pid) > /dev/null && echo "✅ Running" || echo "❌ Stopped"
```
**Result**: App runs on http://localhost:3000 and stays running

### 2. **Making Changes**
```bash
# Edit files in:
# - src/components/     (UI components)
# - src/app/api/       (API routes)  
# - src/app/           (pages)

# Changes auto-reload in browser
```

### 3. **Testing Locally**
```bash
# Test development build
npm run dev          # http://localhost:3000

# Test production build locally
npm run build
npm run start        # Production mode locally
```

### 4. **Ready to Deploy**
```bash
# Option A: Quick deploy (no git)
npm run deploy:quick

# Option B: Full deploy (git + vercel)
npm run deploy:full

# Option C: Manual control
git add .
git commit -m "feat: describe your changes"
git push origin main
npx vercel --prod --yes
```

## Common Issues & Solutions

### **"Cannot find module" Errors**
```bash
# Solution: Clean build artifacts
rm -rf .next node_modules/.cache
npm install
npm run dev
```

### **Port Already in Use**
```bash
# Next.js automatically uses next available port
# Check server.log for actual port: "Local: http://localhost:3001"
```

### **Database Connection Issues**
- **Local Development**: May show DB errors (normal if network issues)
- **Production**: Database works fine on Vercel
- **Solution**: Focus on UI/logic during local dev, test DB on production

### **Build vs Development Differences**
- **Development** (`npm run dev`): Fast compilation, debug info
- **Production** (`npm run build`): Optimized, compressed, no debug info

## Development Commands Reference

```bash
# Development  
npm run dev > server.log 2>&1 & echo $! > server.pid  # Start development server (background)
kill $(cat server.pid) && rm server.pid               # Stop development server
npm run build           # Test production build
npm run start           # Run production build locally
npm run lint            # Check code quality

# Deployment
npm run deploy:check    # Verify build + lint
npm run deploy:quick    # Deploy without git
npm run deploy:full     # Git commit + deploy

# Debugging
rm -rf .next            # Clear Next.js cache
npm install             # Reinstall dependencies
```

## Recommended Workflow

### **Daily Development**
1. `npm run dev` - Start development server
2. Make changes, test in browser
3. When feature complete: `npm run deploy:check`
4. If passes: `npm run deploy:full`

### **When Things Break**
1. `rm -rf .next node_modules/.cache`
2. `npm install`
3. `npm run dev`

### **Before Important Releases**
1. `npm run build` - Test production build
2. `npm run start` - Test production locally
3. `npm run deploy:full` - Deploy to production

## Your Setup is Now Solid!
- ✅ Local development works
- ✅ Production deployment works  
- ✅ Automated deployment pipeline
- ✅ Proper environment separation