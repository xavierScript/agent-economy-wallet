#!/usr/bin/env bash
# Agent Economy Wallet — One-command skill installer for OpenClaw VMs
#
# Usage (on the VM):
#   git clone <repo-url> && cd agent_economy_wallet && bash install.sh
#
# What this does:
#   1. Installs Node dependencies
#   2. Symlinks the Agent Economy Wallet skill into ~/.openclaw/skills/
#   3. Prints next steps

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     Agent Economy Wallet — OpenClaw Installer      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Check Node.js ─────────────────────────────────────────────────────────
echo "→ Checking Node.js..."
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Install Node.js 18+ and re-run."
  exit 1
fi
echo "  ✅ $(node -v)"

# ── 2. Install dependencies ───────────────────────────────────────────────────
echo "→ Installing dependencies..."
PNPM_CMD="pnpm"
if ! command -v pnpm &>/dev/null; then
  PNPM_CMD="npx --yes pnpm"
fi
cd "$SCRIPT_DIR"
$PNPM_CMD install --reporter=silent 2>/dev/null || $PNPM_CMD install
$PNPM_CMD build
echo "  ✅ Dependencies installed and built"

# ── 3. Locate OpenClaw skills directory ───────────────────────────────────────
OPENCLAW_SKILLS="${HOME}/.openclaw/skills"
mkdir -p "$OPENCLAW_SKILLS"

# ── 4. Link skill ─────────────────────────────────────────────────────────────
echo "→ Installing Agent Economy Wallet skill into $OPENCLAW_SKILLS ..."
SKILL="agent-economy-wallet"
SRC="$SCRIPT_DIR/packages/skills/$SKILL"
DEST="$OPENCLAW_SKILLS/$SKILL"

if [[ -d "$SRC" ]]; then
  rm -rf "$DEST"
  ln -s "$SRC" "$DEST"
  echo "  ✅ $SKILL → $SRC"
else
  echo "  ❌ $SKILL not found at $SRC"
fi

# ── 5. Create config directory for wallet credentials ─────────────────────────
mkdir -p "${HOME}/.agent_economy_wallet"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║         Installation Complete! 🎉            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Skills installed to: $OPENCLAW_SKILLS"
echo ""
echo "Next steps:"
echo "  1. Restart (or start) your OpenClaw gateway"
echo "  2. Message your agent: 'I need a Solana wallet'"
echo "     → The agent will provision it for you"
echo "  3. Once provisioned, you can ask:"
echo "     → 'What is my balance?'"
echo "     → 'Send 0.1 SOL to <address>'"
echo "     → 'Pay the x402 invoice for <endpoint>'"
echo ""
