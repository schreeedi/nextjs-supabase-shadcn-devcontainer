#!/usr/bin/env bash
set -euo pipefail

echo "── Setting claude permissions ───────────────────────────"
sudo chown -R node:node /home/node/.claude

echo "── Installing npm dependencies (incl. Supabase CLI) ─────"
npm install
npx supabase --version

echo "── Creating .env.local from example (if missing) ────────"
if [ ! -f .env.local ]; then
  cp .env.local.example .env.local
  echo "Created .env.local with local Supabase defaults."
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Setup complete."
echo ""
echo "  Supabase starts automatically on each"
echo "  container start."
echo ""
echo "  Studio UI:  http://localhost:54323"
echo "════════════════════════════════════════════════════════"
