#!/bin/bash
# Devnet SOL Airdrop — request free devnet SOL for any Solana wallet
# Usage: bash airdrop.sh <wallet_address> [amount_sol]
#
# Fallback chain:
#   1. Primary RPC (requestAirdrop)
#   2. Retry primary after 15s backoff (rate-limit recovery)
#   3. Solana web faucet API (faucet.solana.com)
#   4. Error with manual fallback URLs for human/agent action

set -euo pipefail

WALLET="${1:-}"
AMOUNT="${2:-1}"
RPC_URL="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
WEB_FAUCET_URL="https://faucet.solana.com/api/airdrop"
RETRY_DELAY=15

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

# ── Helper: fetch current balance ─────────────────────────────────────────────
get_balance() {
  local BAL_RESP
  BAL_RESP=$(curl -s -f -X POST "$RPC_URL" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getBalance\",\"params\":[\"$WALLET\"]}" \
    --max-time 10 2>/dev/null) || true
  echo "$BAL_RESP" | grep -o '"value":[0-9]*' | sed 's/"value"://' || echo "0"
}

# ── Helper: try RPC requestAirdrop ────────────────────────────────────────────
try_rpc_airdrop() {
  curl -s -f -X POST "$RPC_URL" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"requestAirdrop\",\"params\":[\"$WALLET\",$LAMPORTS]}" \
    --max-time 30 2>/dev/null || echo ""
}

# ── Helper: try Solana web faucet API ─────────────────────────────────────────
try_web_faucet() {
  curl -s -f -X POST "$WEB_FAUCET_URL" \
    -H "Content-Type: application/json" \
    -d "{\"pubkey\":\"$WALLET\",\"lamports\":$LAMPORTS}" \
    --max-time 30 2>/dev/null || echo ""
}

# ── Attempt 1: primary RPC ────────────────────────────────────────────────────
RESPONSE=$(try_rpc_airdrop)
RPC_ERROR=""

if [ -n "$RESPONSE" ] && ! echo "$RESPONSE" | grep -q '"error"'; then
  SIGNATURE=$(echo "$RESPONSE" | grep -o '"result":"[^"]*"' | sed 's/"result":"//;s/"$//')
  if [ -n "$SIGNATURE" ]; then
    sleep 2
    BALANCE_LAMPORTS=$(get_balance)
    BALANCE_SOL=$(echo "scale=9; ${BALANCE_LAMPORTS:-0} / 1000000000" | bc 2>/dev/null || echo "unknown")
    echo "{\"success\": true, \"attempt\": 1, \"source\": \"rpc-primary\", \"signature\": \"$SIGNATURE\", \"amountSol\": $AMOUNT, \"newBalanceSol\": $BALANCE_SOL, \"wallet\": \"$WALLET\", \"explorer\": \"https://explorer.solana.com/tx/$SIGNATURE?cluster=devnet\"}"
    exit 0
  fi
fi

RPC_ERROR=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | head -1 | sed 's/"message":"//;s/"$//' || echo "unknown error")

# ── Attempt 2: retry primary RPC after backoff ────────────────────────────────
sleep $RETRY_DELAY

RESPONSE=$(try_rpc_airdrop)

if [ -n "$RESPONSE" ] && ! echo "$RESPONSE" | grep -q '"error"'; then
  SIGNATURE=$(echo "$RESPONSE" | grep -o '"result":"[^"]*"' | sed 's/"result":"//;s/"$//')
  if [ -n "$SIGNATURE" ]; then
    sleep 2
    BALANCE_LAMPORTS=$(get_balance)
    BALANCE_SOL=$(echo "scale=9; ${BALANCE_LAMPORTS:-0} / 1000000000" | bc 2>/dev/null || echo "unknown")
    echo "{\"success\": true, \"attempt\": 2, \"source\": \"rpc-retry\", \"signature\": \"$SIGNATURE\", \"amountSol\": $AMOUNT, \"newBalanceSol\": $BALANCE_SOL, \"wallet\": \"$WALLET\", \"explorer\": \"https://explorer.solana.com/tx/$SIGNATURE?cluster=devnet\"}"
    exit 0
  fi
fi

# ── Attempt 3: Solana web faucet ──────────────────────────────────────────────
WEB_RESPONSE=$(try_web_faucet)

if [ -n "$WEB_RESPONSE" ] && ! echo "$WEB_RESPONSE" | grep -qi '"error"\|"failed"\|"too many"'; then
  # Web faucet returns the signature directly as a plain string or in a field
  SIGNATURE=$(echo "$WEB_RESPONSE" | grep -o '"signature":"[^"]*"' | sed 's/"signature":"//;s/"$//' || \
              echo "$WEB_RESPONSE" | grep -o '"txid":"[^"]*"' | sed 's/"txid":"//;s/"$//' || \
              echo "$WEB_RESPONSE" | tr -d '"{}' | grep -oE '[1-9A-HJ-NP-Za-km-z]{64,}' | head -1 || echo "")
  if [ -n "$SIGNATURE" ]; then
    sleep 2
    BALANCE_LAMPORTS=$(get_balance)
    BALANCE_SOL=$(echo "scale=9; ${BALANCE_LAMPORTS:-0} / 1000000000" | bc 2>/dev/null || echo "unknown")
    echo "{\"success\": true, \"attempt\": 3, \"source\": \"web-faucet\", \"signature\": \"$SIGNATURE\", \"amountSol\": $AMOUNT, \"newBalanceSol\": $BALANCE_SOL, \"wallet\": \"$WALLET\", \"explorer\": \"https://explorer.solana.com/tx/$SIGNATURE?cluster=devnet\"}"
    exit 0
  fi
fi

# ── All attempts failed — ask the human to fund manually ─────────────────────
cat <<EOF
{
  "success": false,
  "rateLimited": true,
  "rpcError": "$RPC_ERROR",
  "wallet": "$WALLET",
  "amountSol": $AMOUNT,
  "humanActionRequired": true,
  "agentInstruction": "All automated airdrop attempts failed. You must now ask the user to fund the wallet manually. Show them the wallet address and the options below.",
  "messageToUser": "The devnet faucet is currently rate-limited and could not fund your wallet automatically. Please fund it manually using one of these options:",
  "manualOptions": [
    {
      "option": 1,
      "method": "Web faucet (recommended)",
      "url": "https://faucet.solana.com/?pubkey=$WALLET",
      "instruction": "Open this URL in a browser, confirm the address is $WALLET, and request $AMOUNT SOL."
    },
    {
      "option": 2,
      "method": "Alternative web faucet",
      "url": "https://solfaucet.com/",
      "instruction": "Paste your wallet address ($WALLET) and request SOL."
    },
    {
      "option": 3,
      "method": "Solana CLI (if installed)",
      "command": "solana airdrop $AMOUNT $WALLET --url devnet",
      "instruction": "Run this command in your terminal."
    },
    {
      "option": 4,
      "method": "Retry this script",
      "instruction": "Wait 60 seconds for the rate-limit to reset, then run: bash airdrop.sh $WALLET $AMOUNT"
    }
  ],
  "confirmationHint": "Once funded, run check-balance.sh $WALLET to confirm the balance arrived, then continue."
}
EOF
exit 1
