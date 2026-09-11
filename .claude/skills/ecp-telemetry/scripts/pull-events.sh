#!/usr/bin/env bash
# Pull the ECP Calculator print-telemetry CSV from production.
# Usage: pull-events.sh [OUT_DIR]   (default: ./telemetry-exports, gitignored)
# The export key is injected from 1Password via op-with; it never appears in output.
set -euo pipefail

OP_DIR=/srv/bea-ai-tools/scripts/op
BASE_URL="${ECP_BASE_URL:-https://ecp.baselineenergy.ca}"
OUT_DIR="${1:-./telemetry-exports}"
STAMP="$(date +%Y%m%d-%H%M)"
OUT="$OUT_DIR/ecp-events-$STAMP.csv"

mkdir -p "$OUT_DIR"
[ -x "$OP_DIR/op-with" ] || { echo "op-with not found at $OP_DIR (run this on bae as Ryan)" >&2; exit 2; }

code=$("$OP_DIR/op-with" railway-ecp -- sh -c \
  "curl -s -m 60 -o '$OUT' -w '%{http_code}' -H \"Authorization: Bearer \$EVENTS_EXPORT_KEY\" '$BASE_URL/api/events.csv'")

case "$code" in
  200) ;;
  401) rm -f "$OUT"; echo "401 unauthorized: vault key (BEA-service/railway-ecp/ecp-events-export-key) does not match EVENTS_EXPORT_KEY on Railway" >&2; exit 1 ;;
  503) rm -f "$OUT"; echo "503: export or database not configured on the server" >&2; exit 1 ;;
  *)   rm -f "$OUT"; echo "HTTP $code from $BASE_URL/api/events.csv" >&2; exit 1 ;;
esac

rows=$(( $(wc -l < "$OUT") - 1 ))
echo "$OUT"
echo "$rows events"
