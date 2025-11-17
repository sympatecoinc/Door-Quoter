# Door Quoter - Laptop Setup Guide
Date: 2025-11-13

This guide will help you set up the Door Quoter development environment on your laptop with the same devcontainer configuration.

## Prerequisites

Install these on your laptop before proceeding:

### 1. Essential Software
- **Git**: Version control
  ```bash
  # macOS
  brew install git

  # Windows
  # Download from https://git-scm.com/download/win

  # Linux (Ubuntu/Debian)
  sudo apt-get install git
  ```

- **Docker Desktop**: Required for devcontainers
  - macOS/Windows: Download from https://www.docker.com/products/docker-desktop
  - Linux: Install Docker Engine and Docker Compose
  ```bash
  # Linux
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  ```

- **Visual Studio Code**: Your IDE
  - Download from https://code.visualstudio.com/

### 2. VS Code Extensions
Install the Dev Containers extension:
```bash
code --install-extension ms-vscode-remote.remote-containers
```

Or install from VS Code:
1. Open VS Code
2. Go to Extensions (Cmd/Ctrl+Shift+X)
3. Search for "Dev Containers"
4. Install the extension by Microsoft

### 3. Google Cloud SDK (Optional - only if accessing Cloud SQL)
```bash
# macOS
brew install google-cloud-sdk

# Windows
# Download from https://cloud.google.com/sdk/docs/install

# Linux
curl https://sdk.cloud.google.com | bash
```

## Transfer Methods

Choose one of the following methods to transfer the project to your laptop:

### Method 1: Git Clone (Recommended if using version control)

If your project is in a Git repository:

```bash
# On your laptop
cd ~/projects  # or wherever you want the project
git clone <your-repo-url> Door-Quoter
cd Door-Quoter
```

### Method 2: Direct Copy via rsync (Network transfer)

If both machines are on the same network:

```bash
# On your laptop
# First, find your current machine's IP or hostname
# Then run:
rsync -avz --progress kylepalmer@<current-machine-ip>:~/projects/Door-Quoter/ ~/projects/Door-Quoter/

# Example:
# rsync -avz --progress kylepalmer@192.168.1.100:~/projects/Door-Quoter/ ~/projects/Door-Quoter/
```

### Method 3: USB/External Drive

```bash
# On your current machine
cp -r ~/projects/Door-Quoter /Volumes/YourUSBDrive/

# On your laptop (after connecting USB)
cp -r /Volumes/YourUSBDrive/Door-Quoter ~/projects/
```

### Method 4: Cloud Storage (Dropbox, Google Drive, etc.)

```bash
# On your current machine
zip -r ~/Desktop/Door-Quoter.zip ~/projects/Door-Quoter

# Upload Door-Quoter.zip to your cloud storage
# Download on laptop and extract:
unzip Door-Quoter.zip -d ~/projects/
```

## Important Files to Handle

### Environment Variables (.env files)
The `.env.local` file contains sensitive information and is gitignored. You need to:

1. **If using Git Clone**: Create `.env.local` from the example
   ```bash
   cd ~/projects/Door-Quoter
   cp .env.local.example .env.local
   # Then edit .env.local with your actual credentials
   ```

2. **If copying directly**: The `.env.local` should copy over, but verify it exists:
   ```bash
   ls -la ~/projects/Door-Quoter/.env.local
   ```

### Cloud SQL Proxy Binary
The `cloud-sql-proxy` binary is large (32MB) and might be gitignored:

```bash
# Download on your laptop if missing
cd ~/projects/Door-Quoter
curl -o cloud-sql-proxy https://dl.google.com/cloudsql/cloud_sql_proxy.darwin.amd64
chmod +x cloud-sql-proxy
```

For Linux:
```bash
curl -o cloud-sql-proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64
chmod +x cloud-sql-proxy
```

For Windows:
```bash
# Download cloud_sql_proxy.exe from:
# https://dl.google.com/cloudsql/cloud_sql_proxy.x64.exe
```

## Setup Steps on Laptop

### 1. Verify Project Structure
```bash
cd ~/projects/Door-Quoter
ls -la .devcontainer  # Should show devcontainer.json and docker-compose.yml
ls -la .vscode        # Should show settings.json
```

### 2. Start Docker Desktop
Make sure Docker Desktop is running before opening the project.

### 3. Open in VS Code
```bash
code ~/projects/Door-Quoter
```

### 4. Open in Container
When VS Code opens, you should see a notification:
"Folder contains a Dev Container configuration file. Reopen folder to develop in a container"

Click **"Reopen in Container"**

Or manually:
1. Press Cmd/Ctrl+Shift+P
2. Type "Dev Containers: Reopen in Container"
3. Press Enter

### 5. Wait for Container Build
The first time will take several minutes as it:
- Builds the Docker containers
- Installs npm dependencies
- Generates Prisma client

### 6. Verify Setup
Once the container is running, open the integrated terminal in VS Code:

```bash
# Check Node version
node --version

# Check npm packages
npm list --depth=0

# Check Prisma
npx prisma --version
```

## Post-Setup Configuration

### Google Cloud Authentication (if needed)
If you need to access Cloud SQL databases:

```bash
# In the VS Code terminal (inside container or outside)
gcloud auth login
gcloud config set project door-quoter
```

### Database Setup
Follow the instructions in `MANUAL_DATABASE_MIGRATION_GUIDE.md` for connecting to databases.

### Test the Development Server
```bash
npm run dev
```

Visit http://localhost:3000 to verify the app is running.

## Troubleshooting

### Docker Issues
- **Error: "Cannot connect to Docker daemon"**
  - Solution: Make sure Docker Desktop is running

- **Error: "Port already in use"**
  - Solution: Stop any processes using ports 3000 or 5432
  ```bash
  lsof -ti:3000 | xargs kill -9
  lsof -ti:5432 | xargs kill -9
  ```

### Permission Issues (Linux)
```bash
# Add your user to docker group
sudo usermod -aG docker $USER
# Log out and back in for changes to take effect
```

### Container Won't Build
```bash
# Clean Docker cache and rebuild
docker system prune -a
# Then reopen in container
```

### Missing Node Modules
```bash
# Inside the container terminal
npm install
npx prisma generate
```

## Syncing Changes Between Machines

### Option 1: Git (Recommended)
```bash
# On current machine - commit and push changes
git add .
git commit -m "Your changes"
git push

# On laptop - pull changes
git pull
```

### Option 2: Rsync for Quick Sync
```bash
# Create a sync script: ~/sync-door-quoter.sh
#!/bin/bash
rsync -avz --exclude 'node_modules' \
           --exclude '.next' \
           --exclude '.git' \
           kylepalmer@<current-machine-ip>:~/projects/Door-Quoter/ \
           ~/projects/Door-Quoter/
```

## Quick Reference Commands

```bash
# Open project in container
code ~/projects/Door-Quoter

# Rebuild container (if config changes)
# Cmd/Ctrl+Shift+P -> "Dev Containers: Rebuild Container"

# Start dev server
npm run dev

# Run database migrations
npx prisma migrate dev

# View Docker containers
docker ps

# Stop all containers
docker stop $(docker ps -q)
```

## What Gets Transferred

✅ **Included:**
- Source code (src/, app/, etc.)
- Configuration files (.devcontainer, .vscode, etc.)
- Documentation files
- Package configuration (package.json, package-lock.json)
- Prisma schema

❌ **Not Included (will be regenerated):**
- node_modules/ (reinstalled in container)
- .next/ (build output)
- .git/ (if using zip method - use git clone instead)

🔐 **Handle Manually:**
- .env.local (contains secrets)
- Any API keys or credentials
- cloud-sql-proxy binary (download separately)

## Next Steps

After setup is complete:
1. Review `CLAUDE.md` for development workflow
2. Review `LOCAL_DEVELOPMENT_GUIDE.md` for local development instructions
3. Review `MANUAL_DATABASE_MIGRATION_GUIDE.md` for database setup
4. Test creating a quote to ensure everything works

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Docker Desktop logs
3. Check VS Code Dev Container logs: View -> Output -> Select "Dev Containers"
4. Ensure all prerequisites are installed correctly
