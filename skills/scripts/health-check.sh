#!/bin/bash
# Wallet Health Check — scan all local agent economy wallets for balance and status
# Usage: bash health-check.sh [rpc_url]

set -euo pipefail

RPC_URL="${1:-${SOLANA_RPC_URL:-https://api.devnet.solana.com}}"
HOME_DIR="${HOME:-${USERPROFILE:-$HOME}}"
KEYS_DIR="$HOME_DIR/.agent-economy-wallet/keys"
LOG_DIR="$HOME_DIR/.agent-economy-wallet/logs"

if [ ! -d "$KEYS_DIR" ]; then
  echo '{"error": "No wallet directory found. No wallets have been created yet.", "keysDir": "'"$KEYS_DIR"'"}'
  exit 1
fi

# Count keystore files
KEYSTORE_FILES=$(find "$KEYS_DIR" -name "*.json" ! -name "policy-state.json" 2>/dev/null)
WALLET_COUNT=$(echo "$KEYSTORE_FILES" | grep -c '\.json$' 2>/dev/null || echo "0")

if [ "$WALLET_COUNT" -eq 0 ]; then
  echo '{"walletCount": 0, "message": "No wallets found.", "keysDir": "'"$KEYS_DIR"'"}'
  exit 0
fi

# Check policy state
HAS_POLICY="false"
if [ -f "$KEYS_DIR/policy-state.json" ]; then
  HAS_POLICY="true"
fi

# Check audit logs
TODAY=$(date +%Y-%m-%d)
TODAY_LOG="$LOG_DIR/audit-$TODAY.jsonl"
TODAY_ENTRIES=0
TODAY_FAILURES=0
if [ -f "$TODAY_LOG" ]; then
  TODAY_ENTRIES=$(wc -l < "$TODAY_LOG" | tr -d ' ')
  TODAY_FAILURES=$(grep -c '"success":false' "$TODAY_LOG" 2>/dev/null || echo "0")
fi

# Collect wallet info
WALLETS="["
TOTAL_BALANCE=0
FIRST=true

for KEYFILE in $KEYSTORE_FILES; do
  # Skip non-keystore files
  BASENAME=$(basename "$KEYFILE")
  if [ "$BASENAME" = "policy-state.json" ]; then
    continue
  fi

  # Extract fields from keystore JSON
  WALLET_ID=$(grep -o '"id":"[^"]*"' "$KEYFILE" 2>/dev/null | head -1 | sed 's/"id":"//;s/"$//' || echo "unknown")
  LABEL=$(grep -o '"label":"[^"]*"' "$KEYFILE" 2>/dev/null | head -1 | sed 's/"label":"//;s/"$//' || echo "unknown")
  PUBLIC_KEY=$(grep -o '"publicKey":"[^"]*"' "$KEYFILE" 2>/dev/null | head -1 | sed 's/"publicKey":"//;s/"$//' || echo "unknown")

  if [ "$PUBLIC_KEY" = "unknown" ]; then
    continue
  fi

  # Fetch balance from RPC
  BALANCE_RESPONSE=$(curl -s -f -X POST "$RPC_URL" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getBalance\",\"params\":[\"$PUBLIC_KEY\"]}" \
    --max-time 10 2>/dev/null) || true

  BALANCE_LAMPORTS=$(echo "$BALANCE_RESPONSE" | grep -o '"value":[0-9]*' | sed 's/"value"://' || echo "0")
  BALANCE_LAMPORTS=${BALANCE_LAMPORTS:-0}
  BALANCE_SOL=$(echo "scale=9; $BALANCE_LAMPORTS / 1000000000" | bc 2>/dev/null || echo "0")

  TOTAL_BALANCE=$(echo "$TOTAL_BALANCE + $BALANCE_LAMPORTS" | bc 2>/dev/null || echo "$TOTAL_BALANCE")

  # Low balance warning
  WARNING="null"
  if [ "$BALANCE_LAMPORTS" -lt 10000000 ] 2>/dev/null; then
    WARNING="\"low-balance: < 0.01 SOL\""
  fi

  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    WALLETS="$WALLETS,"
  fi

  WALLETS="$WALLETS{\"id\":\"$WALLET_ID\",\"label\":\"$LABEL\",\"publicKey\":\"$PUBLIC_KEY\",\"balanceSol\":$BALANCE_SOL,\"balanceLamports\":$BALANCE_LAMPORTS,\"warning\":$WARNING}"
done

WALLETS="$WALLETS]"

TOTAL_SOL=$(echo "scale=9; $TOTAL_BALANCE / 1000000000" | bc 2>/dev/null || echo "0")

cat <<EOF
{
  "walletCount": $WALLET_COUNT,
  "totalBalanceSol": $TOTAL_SOL,
  "totalBalanceLamports": $TOTAL_BALANCE,
  "policyStateExists": $HAS_POLICY,
  "todayAuditEntries": $TODAY_ENTRIES,
  "todayFailures": $TODAY_FAILURES,
  "rpcUrl": "$RPC_URL",
  "wallets": $WALLETS
}
EOF
