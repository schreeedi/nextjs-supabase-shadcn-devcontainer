#!/usr/bin/env bash
set -euo pipefail

echo "── Setting claude permissions ───────────────────────────"
sudo chown -R node:node /home/node/.claude

echo "── Installing npm dependencies ──────────────────────────"
npm install

echo "── Installing Supabase CLI ──────────────────────────────"
if ! command -v supabase &> /dev/null; then
  # Install via official binary (recommended over npm global install)
  ARCH=$(dpkg --print-architecture) # amd64 or arm64
  # Release assets are versioned (no "latest" alias), so resolve the tag first
  VERSION=$(curl -fsSL https://api.github.com/repos/supabase/cli/releases/latest \
    | sed -n 's/.*"tag_name": *"v\([^"]*\)".*/\1/p')
  curl -fsSL "https://github.com/supabase/cli/releases/download/v${VERSION}/supabase_${VERSION}_linux_${ARCH}.deb" \
    -o /tmp/supabase.deb
  sudo dpkg -i /tmp/supabase.deb
  rm /tmp/supabase.deb
fi
supabase --version

echo "── Creating .env.local from example (if missing) ────────"
if [ ! -f .env.local ]; then
  cp .env.local.example .env.local
  echo "Created .env.local with local Supabase defaults."
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Setup complete."
echo ""
echo "  Supabase and Next.js start automatically on each"
echo "  container start (dev server logs: /tmp/next-dev.log)."
echo ""
echo "  App:        http://localhost:3000"
echo "  Studio UI:  http://localhost:54323"
echo "════════════════════════════════════════════════════════"
