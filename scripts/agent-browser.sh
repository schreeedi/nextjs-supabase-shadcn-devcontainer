#!/usr/bin/env bash
# agent-browser with Playwright's Chromium (npx playwright install chromium) —
# one browser for E2E tests and agent screenshots. Usage: npm run browser -- open <url>
set -euo pipefail
cd "$(dirname "$0")/.."
: "${AGENT_BROWSER_EXECUTABLE_PATH:=$(node -p "require('@playwright/test').chromium.executablePath()")}"
export AGENT_BROWSER_EXECUTABLE_PATH
exec node_modules/.bin/agent-browser "$@"
