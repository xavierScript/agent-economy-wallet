#!/usr/bin/env node

/**
 * scripts/register.ts
 *
 * CLI script to register a merchant agent on the decentralised on-chain
 * registry (Solana SPL Memo). Run via:
 *
 *   pnpm register --manifest https://your-server.com/.well-known/agent.json
 *
 * What happens:
 * 1. Fetches the manifest URL to validate it's a real agent.json
 * 2. Builds a Solana memo transaction with the registration JSON
 * 3. Signs and sends the tx using the operator's wallet
 * 4. Prints the tx signature + Solscan link
 *
 * The transaction costs ~0.000005 SOL and is permanent on-chain.
 */

import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
loadEnv({ path: resolve(dirname(__filename), "../../../.env") });

import {
  createCoreServices,
  buildRegistrationTx,
} from "@agent-economy-wallet/core";

// ── Parse CLI args ───────────────────────────────────────────────────────────

function parseArgs(): { manifestUrl: string } {
  const args = process.argv.slice(2);
  const manifestIdx = args.indexOf("--manifest");

  if (manifestIdx === -1 || !args[manifestIdx + 1]) {
    console.error("Usage: pnpm register --manifest <url>");
    console.error("Example: pnpm register --manifest https://your-server.com/.well-known/agent.json");
    process.exit(1);
  }

  return { manifestUrl: args[manifestIdx + 1] };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { manifestUrl } = parseArgs();

  console.log(`\n🔍 Fetching manifest from ${manifestUrl}...`);

  // Step 1: Validate manifest
  let manifest: any;
  try {
    const resp = await fetch(manifestUrl, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) {
      console.error(`❌ Manifest URL returned HTTP ${resp.status}`);
      process.exit(1);
    }
    manifest = await resp.json();
  } catch (err: any) {
    console.error(`❌ Failed to fetch manifest: ${err.message}`);
    process.exit(1);
  }

  // Validate shape
  if (!manifest.name || typeof manifest.name !== "string") {
    console.error('❌ Invalid manifest: missing "name" field');
    process.exit(1);
  }
  if (!manifest.wallet || typeof manifest.wallet !== "string") {
    console.error('❌ Invalid manifest: missing "wallet" field');
    process.exit(1);
  }
  if (!manifest.services || !Array.isArray(manifest.services) || manifest.services.length === 0) {
    console.error('❌ Invalid manifest: must have at least one service');
    process.exit(1);
  }

  console.log(`✅ Manifest valid — agent: "${manifest.name}", ${manifest.services.length} service(s)`);

  // Step 2: Build registration transaction
  const services = createCoreServices();
  const wallets = services.keyManager.listWallets();

  if (wallets.length === 0) {
    console.error("❌ No wallets found. Create one first with the MCP server or CLI.");
    process.exit(1);
  }

  // Use the first available wallet
  const walletId = wallets[0].id;
  const walletPubkey = wallets[0].publicKey;

  console.log(`\n📝 Registering on-chain with wallet ${walletPubkey}...`);

  const tx = buildRegistrationTx(
    new (await import("@solana/web3.js")).PublicKey(walletPubkey),
    manifest.name,
    manifestUrl,
  );

  // Step 3: Sign and send
  try {
    const result = await services.walletService.signAndSendTransaction(
      walletId,
      tx,
      {
        action: "registry:register",
        details: {
          agent: manifest.name,
          manifest: manifestUrl,
        },
      },
    );

    const cluster = services.config.cluster;
    const explorerUrl = cluster === "mainnet-beta"
      ? `https://solscan.io/tx/${result.signature}`
      : `https://solscan.io/tx/${result.signature}?cluster=${cluster}`;

    console.log(`\n✅ Registered "${manifest.name}" on-chain`);
    console.log(`   tx: ${result.signature}`);
    console.log(`   ${explorerUrl}`);
    console.log(`\n   Any buyer agent can now discover this merchant via the on-chain registry.\n`);
  } catch (err: any) {
    console.error(`\n❌ Registration failed: ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
