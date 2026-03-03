#!/bin/bash
# Transaction Lookup — fetch details for a Solana transaction by signature
# Usage: bash tx-lookup.sh <signature> [rpc_url]

set -euo pipefail

SIGNATURE="${1:-}"
RPC_URL="${2:-${SOLANA_RPC_URL:-https://api.devnet.solana.com}}"

if [ -z "$SIGNATURE" ]; then
  echo '{"error": "No transaction signature provided."}'
  exit 1
fi

# Base58 signature check (roughly 87-88 chars)
if ! echo "$SIGNATURE" | grep -qE '^[1-9A-HJ-NP-Za-km-z]{64,}$'; then
  echo '{"error": "Invalid transaction signature format. Expected a base58 string."}'
  exit 1
fi

RESPONSE=$(curl -s -f -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getTransaction\",\"params\":[\"$SIGNATURE\",{\"encoding\":\"jsonParsed\",\"maxSupportedTransactionVersion\":0}]}" \
  --max-time 15 2>/dev/null) || {
  echo '{"error": "Failed to reach Solana RPC. Check your connection or RPC URL."}'
  exit 1
}

if echo "$RESPONSE" | grep -q '"error"'; then
  ERROR_MSG=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | head -1 | sed 's/"message":"//;s/"$//')
  echo "{\"error\": \"RPC error: $ERROR_MSG\"}"
  exit 1
fi

# Check if transaction was found
if echo "$RESPONSE" | grep -q '"result":null'; then
  echo "{\"error\": \"Transaction not found. It may not be confirmed yet, or the signature may be wrong.\", \"signature\": \"$SIGNATURE\", \"explorer\": \"https://explorer.solana.com/tx/$SIGNATURE?cluster=devnet\"}"
  exit 1
fi

# Extract key fields
SLOT=$(echo "$RESPONSE" | grep -o '"slot":[0-9]*' | head -1 | sed 's/"slot"://')
BLOCK_TIME=$(echo "$RESPONSE" | grep -o '"blockTime":[0-9]*' | head -1 | sed 's/"blockTime"://')
FEE=$(echo "$RESPONSE" | grep -o '"fee":[0-9]*' | head -1 | sed 's/"fee"://')

# Check for error in meta
if echo "$RESPONSE" | grep -q '"err":null'; then
  STATUS="success"
else
  STATUS="failed"
fi

# Count instructions
INSTRUCTION_COUNT=$(echo "$RESPONSE" | grep -o '"programId"' | wc -l | tr -d ' ')

# Extract signer(s)
SIGNERS=$(echo "$RESPONSE" | grep -o '"pubkey":"[^"]*","signer":true' | grep -o '"pubkey":"[^"]*"' | sed 's/"pubkey":"//;s/"$//' | head -5 | tr '\n' ',' | sed 's/,$//')

# Convert blockTime to ISO date if available
if [ -n "$BLOCK_TIME" ] && [ "$BLOCK_TIME" != "null" ]; then
  TIMESTAMP=$(date -d "@$BLOCK_TIME" -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -r "$BLOCK_TIME" -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")
else
  TIMESTAMP="unknown"
fi

# Fee in SOL
FEE_SOL=$(echo "scale=9; ${FEE:-0} / 1000000000" | bc 2>/dev/null || echo "0")

cat <<EOF
{
  "signature": "$SIGNATURE",
  "status": "$STATUS",
  "slot": ${SLOT:-0},
  "timestamp": "$TIMESTAMP",
  "feeLamports": ${FEE:-0},
  "feeSol": $FEE_SOL,
  "signers": "$(echo $SIGNERS)",
  "instructionCount": $INSTRUCTION_COUNT,
  "explorer": "https://explorer.solana.com/tx/$SIGNATURE?cluster=devnet"
}
EOF
