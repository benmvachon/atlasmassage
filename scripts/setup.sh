#!/usr/bin/env bash
set -euo pipefail

echo "Setting up Atlas Massage development environment..."

# Check Node version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js 20+ required (found v${NODE_VERSION})" >&2
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Copy env file
if [ ! -f apps/api/.env ]; then
  cp .env.example apps/api/.env
  echo "Created apps/api/.env from .env.example — update with your values"
fi

echo "Setup complete. Run 'npm run dev' to start development servers."
