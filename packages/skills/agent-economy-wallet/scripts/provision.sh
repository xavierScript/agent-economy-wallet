#!/usr/bin/env bash
# Agent Economy Wallet — Provisioning Wizard for OpenClaw
# Example: bash provision.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "${HOME}/.agent_economy_wallet"
cd "$SCRIPT_DIR"
npx tsx "$SCRIPT_DIR/provision.ts" "$@"
