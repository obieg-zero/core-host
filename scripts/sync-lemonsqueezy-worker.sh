#!/bin/bash
set -e

# Pobiera produkty z LemonSqueezy, aktualizuje PLUGIN_REPOS w Workerze i deployuje.
# Slug produktu = nazwa repo = runtime ID pluginu (zero mapowań).
#
# Uzycie: LEMONSQUEEZY_API_KEY=xxx ./scripts/sync-lemonsqueezy-worker.sh

WORKER_DIR="$(cd "$(dirname "$0")/../../obieg-zero-store-worker" && pwd)"
WORKER_SRC="$WORKER_DIR/src/index.ts"
API="https://api.lemonsqueezy.com/v1"

if [ -z "$LEMONSQUEEZY_API_KEY" ]; then
  echo "Ustaw LEMONSQUEEZY_API_KEY"
  exit 1
fi

echo "=== Pobieranie produktow z LemonSqueezy ==="
PRODUCTS=$(curl -s "$API/products" \
  -H "Authorization: Bearer $LEMONSQUEEZY_API_KEY" \
  -H "Accept: application/vnd.api+json")

# Generuj PLUGIN_REPOS z productId → obieg-zero/slug
REPOS=$(echo "$PRODUCTS" | python3 -c "
import json, sys
data = json.load(sys.stdin)
lines = []
for p in data['data']:
    pid = p['id']
    slug = p['attributes']['slug']
    name = p['attributes']['name']
    price = p['attributes']['price']
    info = f'{name}, PLN {price/100:.0f}'
    # slug = nazwa repo, repo w org obieg-zero
    lines.append(f\"  '{pid}': 'obieg-zero/{slug}',     // {info}\")
    print(f'  {pid}: {slug} ({info})')
print('---')
print('\n'.join(lines))
")

echo "$REPOS" | sed '/^---$/,$d'

REPO_LINES=$(echo "$REPOS" | sed '1,/^---$/d')

# Aktualizuj PLUGIN_REPOS w Worker
python3 -c "
import re
with open('$WORKER_SRC', 'r') as f:
    src = f.read()
new_block = '''const PLUGIN_REPOS: Record<string, string> = {
$REPO_LINES
}'''
src = re.sub(
    r'const PLUGIN_REPOS: Record<string, string> = \{[^}]*\}',
    new_block,
    src
)
with open('$WORKER_SRC', 'w') as f:
    f.write(src)
"
echo ""
echo "=== Worker zaktualizowany ==="
grep -A10 "PLUGIN_REPOS" "$WORKER_SRC" | head -8

# Ustawienie API key + deploy
echo ""
echo "=== Deploy Worker ==="
cd "$WORKER_DIR"
echo "$LEMONSQUEEZY_API_KEY" | npx wrangler secret put LEMONSQUEEZY_API_KEY 2>&1 | tail -1
npx wrangler deploy 2>&1 | tail -3

echo ""
echo "=== Gotowe ==="
