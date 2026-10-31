#!/usr/bin/env bash
set -uo pipefail

# After a host/Docker restart, Docker's restart policy brings the Supabase
# containers back up on its own. If `supabase start` runs while the db
# container is still starting, its health check fails with a spurious
# "container is not ready" error. Wait for the db container to be healthy
# (or absent, on a fresh setup) before starting.
project_id=$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' supabase/config.toml)
db_container="supabase_db_${project_id}"
for _ in $(seq 60); do
  state=$(docker inspect -f '{{.State.Health.Status}}' "$db_container" 2>/dev/null) || break
  [ "$state" = "healthy" ] && break
  sleep 1
done

npx supabase start || true

# Local keys (service role …) from the running stack into .env.local.
bash scripts/local-env.sh || true

echo "You can run \"npm run dev\" to start the Next.js dev server, or run \"npx supabase stop\" to stop the Supabase services."
