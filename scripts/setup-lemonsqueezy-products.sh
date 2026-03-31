#!/bin/bash

# Porownuje pluginy w GitHub org obieg-zero z produktami w LemonSqueezy
# Wyswietla tabelke do dodania w dashboardzie
#
# Uzycie: ./scripts/setup-lemonsqueezy-products.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

[ -f "$ROOT/.env" ] && export $(grep -v '^#' "$ROOT/.env" | xargs)

if [ -z "$LEMONSQUEEZY_API_KEY" ]; then
  echo "Brak LEMONSQUEEZY_API_KEY w .env"
  exit 1
fi

GH_REPOS=$(gh repo list obieg-zero --limit 100 --json name,description --jq '.[] | select(.name | startswith("plugin-")) | "\(.name)\t\(.description)"' | sort)

LS_PRODUCTS=$(curl -s "https://api.lemonsqueezy.com/v1/products" \
  -H "Authorization: Bearer $LEMONSQUEEZY_API_KEY" \
  -H "Accept: application/vnd.api+json" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
for p in data['data']:
    print(p['attributes']['slug'])
" | sort)

printf "\n"
printf "  %-25s %-50s %s\n" "NAZWA" "OPIS" "STATUS"
printf "  %-25s %-50s %s\n" "-------------------------" "--------------------------------------------------" "------"

MISSING=0
while IFS=$'\t' read -r name desc; do
  if echo "$LS_PRODUCTS" | grep -qx "$name"; then
    status="OK"
  else
    status="BRAK"
    MISSING=$((MISSING + 1))
  fi
  printf "  %-25s %-50s %s\n" "$name" "$desc" "$status"
done <<< "$GH_REPOS"

printf "\n"
if [ $MISSING -eq 0 ]; then
  echo "  Wszystko zsynchronizowane!"
else
  echo "  Brakuje $MISSING produktow w LemonSqueezy."
  echo "  Dodaj je recznie: https://app.lemonsqueezy.com/products"
fi
printf "\n"
