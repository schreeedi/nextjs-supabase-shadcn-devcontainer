#!/usr/bin/env bash
set -uo pipefail

supabase start || true

echo "You can run \"npm run dev\" to start the Next.js dev server, or run \"supabase stop\" to stop the Supabase services."
