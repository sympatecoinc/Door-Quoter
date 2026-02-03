#!/bin/bash
# Script to restore .env file from backup
# Usage: ./scripts/restore-env.sh

ENV_FILE="/home/kylepalmer/Door-Quoter/.env"
BACKUP_DIR="/home/kylepalmer/Door-Quoter/backups"

if [ -f "$ENV_FILE" ]; then
    echo ".env file already exists at $ENV_FILE"
    echo "If you want to restore from backup, first move or rename the existing file."
    exit 1
fi

# Find the most recent backup
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/.env.backup.* 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "ERROR: No .env backup found in $BACKUP_DIR"
    echo ""
    echo "Available options:"
    echo "  1. Check if .env.example exists and copy it manually"
    echo "  2. Restore from version control if applicable"
    echo "  3. Contact the team for the correct configuration"
    exit 1
fi

echo "Found backup: $LATEST_BACKUP"
echo ""
read -p "Restore .env from this backup? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    cp "$LATEST_BACKUP" "$ENV_FILE"
    echo "SUCCESS: .env restored from $LATEST_BACKUP"
else
    echo "Restore cancelled."
fi
