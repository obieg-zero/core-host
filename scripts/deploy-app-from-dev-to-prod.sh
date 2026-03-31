#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Build pluginow ==="
cd "$ROOT/../plugins"
npm run build

echo "=== Bump minor version ==="
cd "$ROOT"
CURRENT=$(node -p "require('./package.json').version")
IFS='.' read -r major minor patch <<< "$CURRENT"
NEW="$major.$((minor + 1)).0"
sed -i "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" "$ROOT/package.json"
echo "  $CURRENT -> $NEW"

echo "=== Build aplikacji ==="
npx vite build

echo "=== Config prod: tylko manager + darkmode ==="
cat > "$ROOT/dist/config.json" << 'CONF'
[
  {
    "pluginUri": "obieg-zero/plugin-manager@main"
  },
  {
    "pluginUri": "obieg-zero/plugin-darkmode@main",
    "defaultOptions": {
      "theme": "dracula"
    }
  }
]
CONF

echo "=== Lokalne pluginy (./plugin-*) kopiowane do dist ==="
grep -oP '\./plugin-[^"]+' "$ROOT/dist/config.json" | while read spec; do
  name="${spec#./}"
  if [ -f "$ROOT/../plugins/$name/index.mjs" ]; then
    mkdir -p "$ROOT/dist/$name"
    cp "$ROOT/../plugins/$name/index.mjs" "$ROOT/dist/$name/index.mjs"
    echo "  skopiowano $name"
  fi
done

echo "=== Deploy na obieg-zero.github.io/app/ ==="
cd "$ROOT/dist"
rm -rf .git
git init
git checkout -b main
git add -A
git commit -m "Deploy prod $(date +%Y-%m-%d_%H:%M)"
git remote add origin https://github.com/obieg-zero/obieg-zero.github.io.git
git push -u origin main --force

echo ""
echo "=== Gotowe: https://obieg-zero.github.io/ ==="
