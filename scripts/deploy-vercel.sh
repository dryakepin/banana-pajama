#!/usr/bin/env bash
set -euo pipefail

# Banana Pajama Zombie Shooter - Vercel Deployment Script
# Usage:
#   ./scripts/deploy-vercel.sh              # Preview deployment
#   ./scripts/deploy-vercel.sh --prod       # Production deployment
#   ./scripts/deploy-vercel.sh --prod --skip-build   # Skip local build check

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# --- Parse flags ---
PRODUCTION=false
SKIP_BUILD=false
for arg in "$@"; do
    case "$arg" in
        --prod|--production) PRODUCTION=true ;;
        --skip-build) SKIP_BUILD=true ;;
        --help|-h)
            echo "Usage: $0 [--prod] [--skip-build]"
            echo ""
            echo "  --prod         Deploy to production (default: preview)"
            echo "  --skip-build   Skip local build verification"
            exit 0
            ;;
        *) echo "Unknown flag: $arg"; exit 1 ;;
    esac
done

# --- Preflight checks ---
echo "=== Preflight checks ==="

# Vercel CLI
if ! command -v vercel &>/dev/null; then
    echo "Error: vercel CLI not found. Install with: npm i -g vercel"
    exit 1
fi
echo "  vercel CLI: $(vercel --version)"

# Node
if ! command -v node &>/dev/null; then
    echo "Error: node not found"
    exit 1
fi
echo "  node: $(node --version)"

# Check for uncommitted changes
if ! git diff --quiet HEAD 2>/dev/null; then
    echo ""
    echo "Warning: You have uncommitted changes."
    echo "  Vercel deploys from your local files, not from git."
    read -rp "  Continue anyway? [y/N] " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 0
fi

echo "  git branch: $(git branch --show-current)"
echo ""

# --- Install dependencies ---
echo "=== Installing dependencies ==="
npm install --prefix server --silent
npm install --prefix client --silent
echo "  Done."
echo ""

# --- Build client ---
if [ "$SKIP_BUILD" = false ]; then
    echo "=== Building client ==="
    npm run build --prefix client

    # Verify build output
    if [ ! -f client/dist/index.html ]; then
        echo "Error: Build failed — client/dist/index.html not found"
        exit 1
    fi

    BUNDLE_SIZE=$(du -sh client/dist | cut -f1)
    echo "  Build output: client/dist ($BUNDLE_SIZE)"
    echo ""
else
    echo "=== Skipping build (--skip-build) ==="
    echo ""
fi

# --- Deploy ---
if [ "$PRODUCTION" = true ]; then
    echo "=== Deploying to PRODUCTION ==="
    echo ""
    DEPLOY_URL=$(vercel --prod --yes 2>&1 | tee /dev/tty | grep -oE 'https://[^ ]+' | tail -1)
else
    echo "=== Deploying preview ==="
    echo ""
    DEPLOY_URL=$(vercel --yes 2>&1 | tee /dev/tty | grep -oE 'https://[^ ]+' | tail -1)
fi

echo ""
echo "=== Deployment complete ==="
echo "  URL: ${DEPLOY_URL:-"(check output above)"}"

# --- Post-deploy health check ---
if [ -n "${DEPLOY_URL:-}" ]; then
    echo ""
    echo "=== Health check ==="
    sleep 3
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${DEPLOY_URL}/api/health" 2>/dev/null)
    if [ "$HTTP_STATUS" = "200" ]; then
        echo "  API health: OK (200)"
    else
        echo "  API health: ${HTTP_STATUS} (may need a moment to warm up)"
    fi
fi
