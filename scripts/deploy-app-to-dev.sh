#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Build pluginow ==="
cd "$ROOT/../plugins"
npm run build

echo "=== Build aplikacji ==="
cd "$ROOT"
npx vite build

echo "=== Config: @main -> @dev ==="
sed -i 's/@main"/@dev"/g' "$ROOT/dist/config.json"

echo "=== Lokalne pluginy (./plugin-*) kopiowane do dist ==="
grep -oP '\./plugin-[^"]+' "$ROOT/dist/config.json" | while read spec; do
  name="${spec#./}"
  if [ -f "$ROOT/../plugins/$name/index.mjs" ]; then
    mkdir -p "$ROOT/dist/$name"
    cp "$ROOT/../plugins/$name/index.mjs" "$ROOT/dist/$name/index.mjs"
    echo "  skopiowano $name"
  fi
done

echo "=== Deploy na obieg-zero.github.io/dev/ ==="
cd "$ROOT/dist"
rm -rf .git
git init
git checkout -b gh-pages
git add -A
git commit -m "Deploy dev $(date +%Y-%m-%d_%H:%M)"
git remote add origin https://github.com/obieg-zero/dev.git
git push -u origin gh-pages --force

echo ""
echo "=== Gotowe: https://obieg-zero.github.io/dev/ ==="
