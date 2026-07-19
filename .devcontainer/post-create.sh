#!/usr/bin/env bash
set -euo pipefail

echo "── Installing npm dependencies ──────────────────────────"
npm install

echo "── Installing Supabase CLI ──────────────────────────────"
if ! command -v supabase &> /dev/null; then
  # Install via official binary (recommended over npm global install)
  ARCH=$(dpkg --print-architecture) # amd64 or arm64
  curl -fsSL "https://github.com/supabase/cli/releases/latest/download/supabase_linux_${ARCH}.deb" \
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
echo "  Setup complete. Next steps:"
echo ""
echo "    supabase start     # start local Supabase stack"
echo "    npm run dev        # start Next.js"
echo ""
echo "  Studio UI:  http://localhost:54323"
echo "════════════════════════════════════════════════════════"
