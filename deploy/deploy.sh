#!/usr/bin/env bash
# Jammy deployment script
# Run from the repo root on the server: bash deploy/deploy.sh
#
# Prerequisites:
#   - Node 18+ installed
#   - /opt/jammy   owns the repo clone
#   - /var/www/jammy exists and is writable by this user (or run with sudo)
#   - systemd service installed (see deploy/jammy-backend.service)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="${WEB_DIR:-/var/www/jammy}"

echo "==> Building frontend..."
cd "$REPO_DIR"
npm ci --prefer-offline
npm run build

echo "==> Copying frontend build to $WEB_DIR..."
sudo mkdir -p "$WEB_DIR"
sudo rsync -a --delete dist/ "$WEB_DIR/"

echo "==> Building backend..."
cd "$REPO_DIR/backend"
npm ci --omit=dev --prefer-offline
npm run build

echo "==> Restarting backend service..."
sudo systemctl restart jammy-backend

echo "==> Done. Check status with: sudo systemctl status jammy-backend"
