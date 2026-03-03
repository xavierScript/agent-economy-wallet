#!/bin/bash
# Devnet SOL Airdrop — request free devnet SOL for any Solana wallet
# Usage: bash airdrop.sh <wallet_address> [amount_sol]

set -euo pipefail

WALLET="${1:-}"
AMOUNT="${2:-1}"
RPC_URL="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"

if [ -z "$WALLET" ]; then
  echo '{"error": "No wallet address provided. Please provide a Solana public key."}'
  exit 1
fi

# Basic base58 format check (32-44 chars)
if ! echo "$WALLET" | grep -qE '^[1-9A-HJ-NP-Za-km-z]{32,44}$'; then
  echo '{"error": "Invalid wallet address format. Expected a base58 Solana public key (32-44 characters)."}'
  exit 1
fi

# Validate amount (1 or 2 SOL — devnet faucet limit)
if ! echo "$AMOUNT" | grep -qE '^[0-9]+(\.[0-9]+)?$'; then
  echo '{"error": "Invalid amount. Must be a positive number (max 2 SOL per request on devnet)."}'
  exit 1
fi

# Convert SOL to lamports for the RPC call
LAMPORTS=$(echo "$AMOUNT * 1000000000" | bc | cut -d. -f1)

RESPONSE=$(curl -s -f -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"requestAirdrop\",\"params\":[\"$WALLET\",$LAMPORTS]}" \
  --max-time 30 2>/dev/null) || {
  echo '{"error": "Failed to reach Solana devnet RPC. The faucet may be rate-limited — wait 30 seconds and try again."}'
  exit 1
}

# Check for RPC error
if echo "$RESPONSE" | grep -q '"error"'; then
  ERROR_MSG=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | head -1 | sed 's/"message":"//;s/"$//')
  echo "{\"error\": \"Airdrop failed: $ERROR_MSG. The devnet faucet may be rate-limited — wait and retry.\"}"
  exit 1
fi

# Extract signature
SIGNATURE=$(echo "$RESPONSE" | grep -o '"result":"[^"]*"' | sed 's/"result":"//;s/"$//')

if [ -z "$SIGNATURE" ]; then
  echo '{"error": "Airdrop request returned no signature. The faucet may be temporarily unavailable."}'
  exit 1
fi

# Fetch balance after a short wait
sleep 2
BALANCE_RESPONSE=$(curl -s -f -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getBalance\",\"params\":[\"$WALLET\"]}" \
  --max-time 10 2>/dev/null) || true

BALANCE_LAMPORTS=$(echo "$BALANCE_RESPONSE" | grep -o '"value":[0-9]*' | sed 's/"value"://' || echo "0")
BALANCE_SOL=$(echo "scale=9; $BALANCE_LAMPORTS / 1000000000" | bc 2>/dev/null || echo "unknown")

echo "{\"success\": true, \"signature\": \"$SIGNATURE\", \"amountSol\": $AMOUNT, \"newBalanceSol\": $BALANCE_SOL, \"wallet\": \"$WALLET\", \"explorer\": \"https://explorer.solana.com/tx/$SIGNATURE?cluster=devnet\"}"
