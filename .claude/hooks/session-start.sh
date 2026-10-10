#!/usr/bin/env bash
# Prépare les sessions cloud : dépendances de l'appli (tests et typecheck prêts à lancer)
# et playwright-cli (navigateur piloté pour tester l'appli web, skill `playwright-cli`).
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR/apps/expo"
npm ci --no-audit --no-fund

# playwright-cli cherche Chrome par défaut ; le cloud fournit Chromium dans /opt/pw-browsers.
command -v playwright-cli >/dev/null || npm i -g --no-audit --no-fund @playwright/cli@0.1.22 || true
if [ -x /opt/pw-browsers/chromium ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PLAYWRIGHT_MCP_BROWSER=chromium PLAYWRIGHT_MCP_EXECUTABLE_PATH=/opt/pw-browsers/chromium' >> "$CLAUDE_ENV_FILE"
fi
