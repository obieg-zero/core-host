#!/bin/bash
# Blokuje bezpośrednie git add/commit/push — dozwolone tylko przez skrypty .sh
CMD=$(jq -r '.tool_input.command // ""')

# Jeśli komenda uruchamia skrypt .sh — przepuść
if echo "$CMD" | grep -qE '\.sh(\s|$|")'; then
  exit 0
fi

# Jeśli komenda zawiera git add/commit/push — zablokuj
if echo "$CMD" | grep -qE '\bgit\s+(add|commit|push)\b'; then
  echo '{"decision":"block","reason":"ZABLOKOWANE: git add/commit/push dozwolone TYLKO przez skrypty z scripts/. Użyj odpowiedniego skryptu deploy."}'
  exit 0
fi
