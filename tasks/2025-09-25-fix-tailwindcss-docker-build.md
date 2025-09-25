# Name: Fix TailwindCSS Docker Build Issue
# Date: 2025-09-25

## Scope
Files to modify:
- Dockerfile: Modify to install all dependencies (including dev) during build stage
- package.json: Keep TailwindCSS in devDependencies (cleaner approach)

## Tasks
- [ ] Task 1: Modify Dockerfile deps stage to install all dependencies for build process
- [ ] Task 2: Test Docker build locally to verify fix
- [ ] Task 3: Commit changes and test via GitHub Actions

## Success Criteria
- Docker build completes successfully without TailwindCSS errors
- Local Docker build works
- GitHub Actions deployment succeeds