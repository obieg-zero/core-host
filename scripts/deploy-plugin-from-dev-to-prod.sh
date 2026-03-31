#!/bin/bash
set -e

# Promuje plugin z dev na main (produkcja) + version bump + git tag + LemonSqueezy wariant
# Uzycie: ./scripts/deploy-plugin-from-dev-to-prod.sh plugin-manager [patch|minor|major]
# Bez argumentu pluginu: wszystkie pluginy ktore maja branch dev
# Domyslny bump: patch
#
# Env vars:
#   LEMONSQUEEZY_API_KEY — klucz API do tworzenia wariantow (opcjonalny)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUMP_TYPE="${2:-patch}"

declare -A PRODUCT_IDS=(
  ["plugin-workflow-crm"]="922634"
  ["plugin-wibor-calc-pro"]="922471"
)

bump_version() {
  local major minor patch
  IFS='.' read -r major minor patch <<< "$1"
  case "$2" in
    major) echo "$((major + 1)).0.0" ;;
    minor) echo "$major.$((minor + 1)).0" ;;
    *)     echo "$major.$minor.$((patch + 1))" ;;
  esac
}

create_ls_variant() {
  [ -z "$LEMONSQUEEZY_API_KEY" ] && { echo "  LEMONSQUEEZY_API_KEY nie ustawiony — pomijam wariant"; return; }

  echo "  LemonSqueezy: tworzenie wariantu v$2 (product $1)..."
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "https://api.lemonsqueezy.com/v1/variants" \
    -H "Authorization: Bearer $LEMONSQUEEZY_API_KEY" \
    -H "Accept: application/vnd.api+json" \
    -H "Content-Type: application/vnd.api+json" \
    -d "{\"data\":{\"type\":\"variants\",\"attributes\":{\"name\":\"v$2\",\"is_subscription\":false},\"relationships\":{\"product\":{\"data\":{\"type\":\"products\",\"id\":\"$1\"}}}}}")

  [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ] \
    && echo "  LemonSqueezy: wariant v$2 utworzony" \
    || echo "  UWAGA: LemonSqueezy zwrocilo $http_code"
}

promote_one() {
  local name="$1"
  local repo="obieg-zero/$name"
  local tmp="/tmp/promote-plugin-$$-$name"
  local new_version=""

  if ! git ls-remote --heads "https://github.com/$repo.git" dev | grep -q dev; then
    echo "  $name — brak brancha dev, pomijam"
    return
  fi

  git clone --quiet "https://github.com/$repo.git" "$tmp"
  pushd "$tmp" > /dev/null
  git checkout main

  local before_merge
  before_merge=$(git rev-parse HEAD)
  git merge origin/dev -m "prod: $name $(date +%Y-%m-%d_%H:%M)"

  if [ "$(git rev-parse HEAD)" = "$before_merge" ]; then
    echo "  $name — bez zmian na dev, pomijam"
    popd > /dev/null
    rm -rf "$tmp"
    return
  fi

  # Version bump bezposrednio w sklonowanym repo
  if [ -f package.json ]; then
    local current_version
    current_version=$(grep -oP '"version":\s*"\K[0-9]+\.[0-9]+\.[0-9]+' package.json || true)
    if [ -n "$current_version" ]; then
      new_version=$(bump_version "$current_version" "$BUMP_TYPE")
      # Sprawdz czy tag juz istnieje — jesli tak, bump dalej
      while git tag -l "v$new_version" | grep -q .; do
        echo "  $name — tag v$new_version juz istnieje, bumpuje dalej"
        new_version=$(bump_version "$new_version" "$BUMP_TYPE")
      done
      sed -i "s/\"version\": *\"$current_version\"/\"version\": \"$new_version\"/" package.json
      git add package.json
      git commit -m "release: v$new_version"
      git tag "v$new_version"
      echo "  $name — wersja: $current_version -> $new_version ($BUMP_TYPE)"
    fi
  fi

  git push origin main --tags
  echo "  $name — dev -> main"

  # Sync wersji do lokalnego package.json
  local local_pkg="$ROOT/../plugins/$name/package.json"
  if [ -n "$new_version" ] && [ -f "$local_pkg" ]; then
    cp package.json "$local_pkg"
    echo "  $name — lokalny package.json zaktualizowany do $new_version"
  fi

  # LemonSqueezy wariant
  if [ -n "$new_version" ] && [ -n "${PRODUCT_IDS[$name]}" ]; then
    create_ls_variant "${PRODUCT_IDS[$name]}" "$new_version"
  fi

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
