# Interior Aluminum Quoting Tool

A professional Next.js application for generating quotes and BOMs for interior aluminum doors and windows.


## 🛠️ Getting Started

### Development Setup
```bash
# Install dependencies
npm ci

# Start development server
npm run dev

# Open http://localhost:3000
```

### Key Scripts
```bash
npm run dev          # Development server
npm run build        # Production build
npm run deploy:quick # Quick Vercel deployment
npm run deploy:full  # Deploy with commit message
```

## 📁 Project Structure
```
src/
  app/              # Next.js App Router
    api/            # API routes
    page.tsx        # Main page
    layout.tsx      # Root layout
  components/       # React components
  hooks/           # Custom hooks
  stores/          # Zustand state management
```




## 🔧 Performance Features
- **10x faster project loading** with server-side optimizations
- **React performance optimizations** (memoization, useCallback)
- **Database query optimizations** for reduced N+1 queries
- **Server-side price calculations**
- **Optimized quote generation** with all component options

## 📋 Tech Stack
- **Framework**: Next.js 15 with React 19
- **Database**: PostgreSQL via Supabase
- **ORM**: Prisma
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## 🚨 Troubleshooting

**Having deployment issues?** See [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md) for:
- 404 NOT_FOUND fixes
- Output directory configuration
- Environment variable setup
- Common deployment problems

## 🔗 Documentation
- [Development Workflow](./DEV_WORKFLOW.md) - Development processes
- [Deployment Agents](./DEPLOYMENT_AGENTS.md) - Automated deployment system

## 🏗️ Features
- **Project Management**: Create and manage door/window projects
- **Component Configuration**: Add doors, windows, corners with options
- **Quote Generation**: Professional PDF quotes with pricing
- **BOM Generation**: Detailed bill of materials with cut lists
- **Shop Drawings**: Technical elevation and plan drawings
- **Performance Dashboard**: Project statistics and insights

---

Built with ❤️ using Next.js and deployed on Vercel
