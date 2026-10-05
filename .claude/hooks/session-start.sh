#!/usr/bin/env bash
# Prépare les sessions cloud : dépendances de l'appli (tests et typecheck prêts à lancer).
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR/apps/expo"
npm install --no-audit --no-fund
