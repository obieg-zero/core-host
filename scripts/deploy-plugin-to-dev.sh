#!/bin/bash
set -e

# Buduje i publikuje plugin na branch dev w GitHub
# Uzycie: ./scripts/deploy-plugin-to-dev.sh plugin-manager
# Bez argumentu: wszystkie pluginy

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

publish_one() {
  local name="$1"
  local dir="$ROOT/../plugins/$name"
  local repo="obieg-zero/$name"
  local tmp="/tmp/deploy-plugin-$$-$name"

  if [ ! -f "$dir/index.mjs" ]; then
    echo "  SKIP $name (brak index.mjs)"
    return
  fi

  git clone --quiet "https://github.com/$repo.git" "$tmp"
  pushd "$tmp" > /dev/null

  if git ls-remote --heads origin dev | grep -q dev; then
    git checkout dev
  else
    git checkout -b dev
  fi

  cp "$dir/index.mjs" ./index.mjs
  git add -A

  if git diff --cached --quiet; then
    echo "  $name — bez zmian"
  else
    git commit -m "dev: $name $(date +%Y-%m-%d_%H:%M)"
    git push -u origin dev
    echo "  $name — opublikowany na @dev"
  fi

  popd > /dev/null
  rm -rf "$tmp"
}

echo "=== Build pluginow ==="
cd "$ROOT/../plugins"
npm run build

echo "=== Publikacja na @dev ==="
if [ -n "$1" ]; then
  publish_one "$1"
else
  for dir in "$ROOT/../plugins"/plugin-*/; do
    publish_one "$(basename "$dir")"
  done
fi

echo "=== Gotowe ==="
