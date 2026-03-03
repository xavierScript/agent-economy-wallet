#!/bin/bash
# Audit Summary — parse local audit logs and produce a JSON summary
# Usage: bash audit-summary.sh [date] [wallet_id]
# date format: YYYY-MM-DD (defaults to today)

set -euo pipefail

DATE="${1:-$(date +%Y-%m-%d)}"
WALLET_FILTER="${2:-}"

# Resolve home directory
HOME_DIR="${HOME:-${USERPROFILE:-$HOME}}"
LOG_DIR="$HOME_DIR/.agentic-wallet/logs"
LOG_FILE="$LOG_DIR/audit-$DATE.jsonl"

if [ ! -d "$LOG_DIR" ]; then
  echo '{"error": "Audit log directory not found. No wallets have been created yet.", "logDir": "'"$LOG_DIR"'"}'
  exit 1
fi

if [ ! -f "$LOG_FILE" ]; then
  # List available log files
  AVAILABLE=$(ls "$LOG_DIR"/audit-*.jsonl 2>/dev/null | sed 's/.*audit-//;s/\.jsonl//' | tr '\n' ',' | sed 's/,$//')
  if [ -z "$AVAILABLE" ]; then
    echo '{"error": "No audit logs found.", "logDir": "'"$LOG_DIR"'"}'
  else
    echo '{"error": "No audit log for '"$DATE"'.", "availableDates": "'"$AVAILABLE"'", "logDir": "'"$LOG_DIR"'"}'
  fi
  exit 1
fi

# Filter by wallet if specified
if [ -n "$WALLET_FILTER" ]; then
  ENTRIES=$(grep "\"walletId\":\"$WALLET_FILTER\"" "$LOG_FILE" 2>/dev/null || true)
else
  ENTRIES=$(cat "$LOG_FILE" 2>/dev/null || true)
fi

if [ -z "$ENTRIES" ]; then
  echo '{"date": "'"$DATE"'", "totalEntries": 0, "message": "No audit entries found for the given criteria."}'
  exit 0
fi

TOTAL=$(echo "$ENTRIES" | wc -l | tr -d ' ')
SUCCESSES=$(echo "$ENTRIES" | grep -c '"success":true' 2>/dev/null || echo "0")
FAILURES=$(echo "$ENTRIES" | grep -c '"success":false' 2>/dev/null || echo "0")

# Count by action type
WALLET_CREATED=$(echo "$ENTRIES" | grep -c '"action":"wallet:created"' 2>/dev/null || echo "0")
SOL_TRANSFERS=$(echo "$ENTRIES" | grep -c '"action":"sol:transfer"' 2>/dev/null || echo "0")
TOKEN_TRANSFERS=$(echo "$ENTRIES" | grep -c '"action":"token:transfer"' 2>/dev/null || echo "0")
SWAPS=$(echo "$ENTRIES" | grep -c '"action":"swap:executed"' 2>/dev/null || echo "0")
MEMOS=$(echo "$ENTRIES" | grep -c '"action":"memo:written"' 2>/dev/null || echo "0")
MINTS=$(echo "$ENTRIES" | grep -c '"action":"mint:created"\|"action":"tokens:minted"' 2>/dev/null || echo "0")
POLICY_VIOLATIONS=$(echo "$ENTRIES" | grep -c '"action":"policy:violation"' 2>/dev/null || echo "0")
X402_PAYMENTS=$(echo "$ENTRIES" | grep -c '"action":"x402:payment_success"' 2>/dev/null || echo "0")
WALLET_CLOSED=$(echo "$ENTRIES" | grep -c '"action":"wallet:closed"' 2>/dev/null || echo "0")

# Unique wallets
UNIQUE_WALLETS=$(echo "$ENTRIES" | grep -o '"walletId":"[^"]*"' | sort -u | wc -l | tr -d ' ')

# Last 5 entries (most recent)
RECENT=$(echo "$ENTRIES" | tail -5)

# Get first and last timestamps
FIRST_TS=$(echo "$ENTRIES" | head -1 | grep -o '"timestamp":"[^"]*"' | sed 's/"timestamp":"//;s/"$//')
LAST_TS=$(echo "$ENTRIES" | tail -1 | grep -o '"timestamp":"[^"]*"' | sed 's/"timestamp":"//;s/"$//')

cat <<EOF
{
  "date": "$DATE",
  "totalEntries": $TOTAL,
  "successes": $SUCCESSES,
  "failures": $FAILURES,
  "uniqueWallets": $UNIQUE_WALLETS,
  "firstEntry": "$FIRST_TS",
  "lastEntry": "$LAST_TS",
  "actions": {
    "walletCreated": $WALLET_CREATED,
    "solTransfers": $SOL_TRANSFERS,
    "tokenTransfers": $TOKEN_TRANSFERS,
    "swaps": $SWAPS,
    "memos": $MEMOS,
    "mints": $MINTS,
    "policyViolations": $POLICY_VIOLATIONS,
    "x402Payments": $X402_PAYMENTS,
    "walletsClosed": $WALLET_CLOSED
  },
  "walletFilter": $([ -n "$WALLET_FILTER" ] && echo "\"$WALLET_FILTER\"" || echo "null"),
  "logFile": "$LOG_FILE"
}
EOF
