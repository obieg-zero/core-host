#!/bin/bash
set -e

# Promuje plugin z dev na main (produkcja)
# Uzycie: ./scripts/deploy-plugin-from-dev-to-prod.sh plugin-manager
# Bez argumentu: wszystkie pluginy ktore maja branch dev

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

promote_one() {
  local name="$1"
  local repo="obieg-zero/$name"
  local tmp="/tmp/promote-plugin-$$-$name"

  if ! git ls-remote --heads "https://github.com/$repo.git" dev | grep -q dev; then
    echo "  $name — brak brancha dev, pomijam"
    return
  fi

  git clone --quiet "https://github.com/$repo.git" "$tmp"
  pushd "$tmp" > /dev/null
  git checkout main
  git merge origin/dev -m "prod: $name $(date +%Y-%m-%d_%H:%M)"
  git push origin main
  echo "  $name — dev -> main"

  popd > /dev/null
  rm -rf "$tmp"
}

echo "=== Promocja na produkcje ==="
if [ -n "$1" ]; then
  promote_one "$1"
else
  for dir in "$ROOT/../plugins"/plugin-*/; do
    promote_one "$(basename "$dir")"
  done
fi

echo "=== Gotowe ==="
