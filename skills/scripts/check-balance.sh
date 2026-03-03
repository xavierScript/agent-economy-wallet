#!/bin/bash
# Balance Check — query any Solana wallet's SOL balance via RPC
# Usage: bash check-balance.sh <wallet_address> [rpc_url]

set -euo pipefail

WALLET="${1:-}"
RPC_URL="${2:-${SOLANA_RPC_URL:-https://api.devnet.solana.com}}"

if [ -z "$WALLET" ]; then
  echo '{"error": "No wallet address provided. Please provide a Solana public key."}'
  exit 1
fi

# Basic base58 format check
if ! echo "$WALLET" | grep -qE '^[1-9A-HJ-NP-Za-km-z]{32,44}$'; then
  echo '{"error": "Invalid wallet address format. Expected a base58 Solana public key (32-44 characters)."}'
  exit 1
fi

# Get SOL balance
BALANCE_RESPONSE=$(curl -s -f -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getBalance\",\"params\":[\"$WALLET\"]}" \
  --max-time 15 2>/dev/null) || {
  echo '{"error": "Failed to reach Solana RPC. Check your connection or RPC URL."}'
  exit 1
}

if echo "$BALANCE_RESPONSE" | grep -q '"error"'; then
  ERROR_MSG=$(echo "$BALANCE_RESPONSE" | grep -o '"message":"[^"]*"' | head -1 | sed 's/"message":"//;s/"$//')
  echo "{\"error\": \"RPC error: $ERROR_MSG\"}"
  exit 1
fi

BALANCE_LAMPORTS=$(echo "$BALANCE_RESPONSE" | grep -o '"value":[0-9]*' | sed 's/"value"://')

if [ -z "$BALANCE_LAMPORTS" ]; then
  echo '{"error": "Could not parse balance from RPC response."}'
  exit 1
fi

BALANCE_SOL=$(echo "scale=9; $BALANCE_LAMPORTS / 1000000000" | bc)

# Get token accounts
TOKEN_RESPONSE=$(curl -s -f -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getTokenAccountsByOwner\",\"params\":[\"$WALLET\",{\"programId\":\"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA\"},{\"encoding\":\"jsonParsed\"}]}" \
  --max-time 15 2>/dev/null) || true

TOKEN_COUNT=$(echo "$TOKEN_RESPONSE" | grep -o '"mint"' | wc -l 2>/dev/null || echo "0")

echo "{\"wallet\": \"$WALLET\", \"balanceLamports\": $BALANCE_LAMPORTS, \"balanceSol\": $BALANCE_SOL, \"tokenAccounts\": $TOKEN_COUNT, \"rpcUrl\": \"$RPC_URL\"}"
