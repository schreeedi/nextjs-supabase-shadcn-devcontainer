#!/usr/bin/env bash
set -euo pipefail

echo "── Supabase project_id from folder name ─────────────────"
# Docker containers and volumes are named after project_id. Two projects from
# this template with the same id would share (and clobber) one local database.
project_id="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-\n' '-')"
if grep -q '^project_id = "nextjs-supabase-shadcn"$' supabase/config.toml \
  && [ "$project_id" != "nextjs-supabase-shadcn-devcontainer" ]; then
  sed -i "s/^project_id = .*/project_id = \"$project_id\"/" supabase/config.toml
  echo "project_id set to $project_id (commit supabase/config.toml)."
fi

echo "── Installing npm dependencies (incl. Supabase CLI) ─────"
npm install
npx supabase --version

echo "── Chromium for Playwright (E2E) and agent-browser ──────"
# One browser for both: npm run browser points agent-browser at it.
# --with-deps installs the system libraries (libnss3, libatk …) via sudo.
npx playwright install --with-deps chromium

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
