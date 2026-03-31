#!/bin/bash

# Tworzy lub synchronizuje plugin jako produkt w Creem
# Czyta description i price z package.json pluginu
#
# Uzycie:
#   ./scripts/setup-creem-products.sh plugin-wibor-calc    — jeden plugin
#   ./scripts/setup-creem-products.sh                      — wszystkie pluginy

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGINS_DIR="$ROOT/../plugins"

[ -f "$ROOT/.env" ] && export $(grep -v '^#' "$ROOT/.env" | xargs)

if [ -z "$CREEM_API_KEY" ]; then
  echo "Brak CREEM_API_KEY w .env"
  exit 1
fi

if [[ "$CREEM_API_KEY" == creem_test_* ]]; then
  API="https://test-api.creem.io/v1"
  echo "=== Tryb TESTOWY ==="
else
  API="https://api.creem.io/v1"
  echo "=== Tryb PRODUKCYJNY ==="
fi

# Pobierz istniejace produkty z Creem
CREEM_PRODUCTS=$(curl -s "$API/products/search" \
  -H "x-api-key: $CREEM_API_KEY" \
  -H "Content-Type: application/json")

sync_one() {
  local name="$1"
  local pkg="$PLUGINS_DIR/$name/package.json"

  if [ ! -f "$pkg" ]; then
    echo "  BLAD: brak $pkg"
    return 1
  fi

  local desc price
  desc=$(python3 -c "import json; d=json.load(open('$pkg')); print(d.get('description',''))")
  price=$(python3 -c "import json; d=json.load(open('$pkg')); print(d.get('price',0))")

  # Sprawdz czy produkt juz istnieje w Creem
  local existing
  existing=$(echo "$CREEM_PRODUCTS" | python3 -c "
import json, sys
data = json.load(sys.stdin)
items = data if isinstance(data, list) else data.get('items', data.get('data', []))
for p in items:
    if p.get('name') == '$name':
        print(p['id'])
        break
" 2>/dev/null)

  if [ -n "$existing" ]; then
    # Sprawdz czy cena w Creem zgadza sie z package.json
    local creem_price
    creem_price=$(echo "$CREEM_PRODUCTS" | python3 -c "
import json, sys
data = json.load(sys.stdin)
items = data if isinstance(data, list) else data.get('items', data.get('data', []))
for p in items:
    if p.get('name') == '$name':
        print(p.get('price', 0))
        break
" 2>/dev/null)
    if [ "$creem_price" != "$price" ]; then
      echo "  !!! $name — NIEZGODNOSC CENY !!! Creem: $creem_price, package.json: $price"
      echo "      Zmien cene recznie w dashboardzie Creem!"
    else
      echo "  $name — OK (ID: $existing, cena: $price)"
    fi
    return 0
  else
    echo "  $name — tworze nowy..."
    RESULT=$(curl -s -X POST "$API/products" \
      -H "x-api-key: $CREEM_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"name\": \"$name\",
        \"description\": \"$desc\",
        \"price\": $price,
        \"currency\": \"USD\",
        \"billing_type\": \"onetime\"
      }")
  fi

  echo "$RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if 'id' in data:
    print(f'    OK — ID: {data[\"id\"]}, cena: {data.get(\"price\",\"?\")}, opis: {data.get(\"description\",\"\")}')
elif 'message' in data:
    msg = data['message']
    print(f'    BLAD: {msg}')
else:
    print(f'    Odpowiedz: {json.dumps(data)[:200]}')
" 2>&1
}

echo ""
if [ -n "$1" ]; then
  sync_one "$1"
else
  for dir in "$PLUGINS_DIR"/plugin-*/; do
    sync_one "$(basename "$dir")"
  done
fi
echo ""
