/**
 * Demo Step 4: Observe Results
 *
 * Reviews audit logs, wallet balances, and agent activity.
 */

import {
  KeyManager,
  WalletService,
  PolicyEngine,
  AuditLogger,
  SolanaConnection,
  getDefaultConfig,
} from "@agentic-wallet/core";

async function main() {
  console.log("🤖 Agentic Wallet - Observe Results\n");

  const config = getDefaultConfig();
  const connection = new SolanaConnection(config.rpcUrl, config.cluster);
  const keyManager = new KeyManager(config.keystoreDir, config.passphrase);
  const policyEngine = new PolicyEngine();
  const auditLogger = new AuditLogger(config.logDir);
  const walletService = new WalletService(
    keyManager,
    policyEngine,
    auditLogger,
    connection,
  );

  // --- Wallet Balances ---
  console.log("💰 Wallet Balances:\n");
  const wallets = await walletService.listWallets();

  for (const w of wallets) {
    console.log(`  ${w.label}`);
    console.log(`    Public Key: ${w.publicKey}`);
    console.log(`    Balance:    ${w.balanceSol.toFixed(6)} SOL`);

    const tokens = await walletService.getTokenBalances(w.id);
    if (tokens.length > 0) {
      console.log("    Tokens:");
      for (const t of tokens) {
        console.log(`      ${t.mint.substring(0, 16)}... → ${t.uiAmount}`);
      }
    }
    console.log();
  }

  // --- Audit Logs ---
  console.log("─".repeat(50));
  console.log("\n📋 Recent Audit Logs (last 20):\n");

  const logs = auditLogger.readRecentLogs(20);
  for (const log of logs) {
    const icon = log.success ? "✓" : "✗";
    const time = new Date(log.timestamp).toLocaleTimeString();
    console.log(`  ${icon} [${time}] ${log.action}`);
    if (log.txSignature) {
      console.log(`    tx: ${log.txSignature.substring(0, 40)}...`);
    }
    if (log.error) {
      console.log(`    error: ${log.error}`);
    }
  }

  console.log("\n─".repeat(50));
  console.log("\n✅ Demo complete!");
  console.log("\nTo launch the dashboard:");
  console.log("  pnpm --filter @agentic-wallet/dashboard dev");
  console.log("\nTo use the CLI:");
  console.log("  pnpm --filter @agentic-wallet/cli build");
  console.log("  npx agentic-wallet status");
}

main().catch(console.error);
