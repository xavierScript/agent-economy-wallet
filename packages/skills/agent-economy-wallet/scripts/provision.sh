#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "${HOME}/.agent_economy_wallet"
cd "$SCRIPT_DIR"

# Remove workspace: dependencies from package.json before installing
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
for (const [key, val] of Object.entries(pkg.dependencies || {})) {
  if (String(val).startsWith('workspace:')) delete pkg.dependencies[key];
}
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

# Install dependencies if not already present
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

npx tsx "$SCRIPT_DIR/provision.ts" "$@"