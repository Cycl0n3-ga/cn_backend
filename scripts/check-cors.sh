#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${1:-${TARGET_URL:-https://eos.cs.nthu.edu.tw/api/v1/problems}}"

TEST_ORIGINS=(
  "http://localhost:3000"
  "http://localhost:3001"
  "https://online-code-judge-phi.vercel.app"
  "https://online-code-judge-phi.vercel.com"
  "https://online-code-judge-phi-pr-123.vercel.app"
  "https://hack-online-code-judge-phi.vercel.app"
  "https://online-code-judge-phi.vercel.app.malicious.com"
  "https://cn-22.vercel.app"
  "https://cn-22-git-main-username.vercel.app"
)

printf '開始測試 CORS 白名單 (目標: %s)\n' "$TARGET_URL"
printf '%s\n' '------------------------------------------------'

for origin in "${TEST_ORIGINS[@]}"; do
  response_headers="$(
    curl -sS -D - -o /dev/null -X OPTIONS "$TARGET_URL" \
      -H "Origin: $origin" \
      -H "Access-Control-Request-Method: GET"
  )"

  allow_origin="$(
    printf '%s\n' "$response_headers" \
      | awk 'tolower($0) ~ /^access-control-allow-origin:/ { sub(/^[^:]+:[[:space:]]*/, ""); gsub(/\r$/, ""); print; exit }'
  )"

  if [[ "$allow_origin" == "$origin" ]]; then
    printf '[允許 Allowed] %s\n' "$origin"
  elif [[ -n "$allow_origin" ]]; then
    printf '[異常 Mismatch] %s (Access-Control-Allow-Origin: %s)\n' "$origin" "$allow_origin"
  else
    printf '[拒絕 Blocked] %s\n' "$origin"
  fi
done

printf '%s\n' '------------------------------------------------'
