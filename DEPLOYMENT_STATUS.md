# GitHub Actions CI/CD Setup Complete

This repository now has automated CI/CD workflows:

- **CI Pipeline**: Runs on every push/PR with testing and linting
- **Production Deployment**: Deploys to Cloud Run on main branch pushes  
- **Staging Deployment**: Deploys to staging on develop branch pushes

## Database Setup
- Production: door-app-db instance
- Staging: door-app-staging instance
- Local Development: Uses Cloud SQL proxy automatically

## Getting Started
1. Run `npm run dev` for local development
2. Push to main branch for production deployment
3. Push to develop branch for staging deployment

