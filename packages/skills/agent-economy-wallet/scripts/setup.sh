#!/usr/bin/env bash
# Agent Economy Wallet Skill — One-command setup
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ROOT_DIR="$SKILL_DIR"
while [[ ! -f "$ROOT_DIR/pnpm-workspace.yaml" ]] && [[ "$ROOT_DIR" != "/" ]]; do
  ROOT_DIR="$(dirname "$ROOT_DIR")"
done

if [[ ! -f "$ROOT_DIR/pnpm-workspace.yaml" ]]; then
  echo "❌ Could not find monorepo root."
  exit 1
fi

echo "→ Checking dependencies..."
cd "$ROOT_DIR"
pnpm install --reporter=silent 2>/dev/null || pnpm install
pnpm build

if [[ -f "${HOME}/.agent_economy_wallet/.env" ]] && grep -q "AGENT_ECONOMY_PUBLIC_KEY" "${HOME}/.agent_economy_wallet/.env" 2>/dev/null; then
  echo "  ✅ Existing wallet configuration found"
else
  echo "  ⚠️  No wallet configuration found in ~/.agent_economy_wallet/.env"
  read -rp "  Would you like to provision a wallet now? [Y/n] " REPLY
  REPLY="${REPLY:-Y}"
  if [[ "$REPLY" =~ ^[Yy]$ ]]; then
    bash "$SCRIPT_DIR/provision.sh"
  fi
fi

echo "✅ Setup Complete"
