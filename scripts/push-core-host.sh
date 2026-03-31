#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MSG="${1:-Aktualizacja core-host $(date +%Y-%m-%d_%H:%M)}"

echo "=== Status ==="
git status --short

echo ""
echo "=== Commit: $MSG ==="
git add -A
git commit -m "$MSG"

echo ""
echo "=== Push ==="
git push

echo ""
echo "=== Gotowe ==="
