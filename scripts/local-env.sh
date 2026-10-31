#!/usr/bin/env bash
# Fill the local Supabase keys into .env.local from the running stack
# (`supabase status`), so no key — not even the well-known local default —
# is committed. GitHub push protection rejects sb_secret_… in any file.
#
#   scripts/local-env.sh   creates .env.local from the example if missing,
#                          then sets keys that are still empty.
#
# Never overwrites a value you set yourself. Runs on every container start
# (.devcontainer/post-start.sh); needs the stack running (npm run db:start).
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${LOCAL_ENV_FILE:-.env.local}"
[ -f "$ENV_FILE" ] || cp .env.local.example "$ENV_FILE"

status="$(node_modules/.bin/supabase status -o env 2>/dev/null)" || {
  echo "local-env: Supabase stack not running — start it with npm run db:start." >&2
  exit 1
}
value() { sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p" <<<"$status"; }

# .env.local key  ←  supabase status key
set_if_empty() {
  local key="$1" val="$2"
  [ -n "$val" ] || return 0
  if grep -q "^${key}=$" "$ENV_FILE"; then
    sed -i "s|^${key}=$|${key}=${val}|" "$ENV_FILE"
    echo "local-env: set $key"
  elif ! grep -q "^${key}=" "$ENV_FILE"; then
    printf '%s=%s\n' "$key" "$val" >>"$ENV_FILE"
    echo "local-env: added $key"
  fi
}

set_if_empty SUPABASE_SERVICE_ROLE_KEY "$(value SECRET_KEY)"
set_if_empty NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "$(value PUBLISHABLE_KEY)"
