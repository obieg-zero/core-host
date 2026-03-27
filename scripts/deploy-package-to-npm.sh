#!/bin/bash
set -e

# Publikuje package na npm
# Uzycie: ./scripts/deploy-package-to-npm.sh sdk
# Bez argumentu: lista dostepnych

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PKG="$1"
if [ -z "$PKG" ]; then
  echo "Uzycie: $0 <nazwa-package>"
  echo "Dostepne:"
  ls -d "$ROOT/../packages"/*/ 2>/dev/null | xargs -I{} basename {}
  exit 1
fi

PKG_DIR="$ROOT/../packages/$PKG"

if [ ! -f "$PKG_DIR/package.json" ]; then
  echo "Brak $PKG_DIR/package.json"
  exit 1
fi

cd "$PKG_DIR"
NAME=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")

echo "=== Publikacja $NAME@$VERSION na npm ==="
npm publish --access public

echo "=== Opublikowano: $NAME@$VERSION ==="
