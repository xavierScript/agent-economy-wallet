/**
 * Demo Step 1: Create Agent Wallets
 *
 * Creates 3 agent wallets with devnet safety policies:
 * 1. DCA Agent - for dollar-cost averaging
 * 2. Rebalance Agent - for portfolio rebalancing
 * 3. Arb Scanner - for arbitrage detection
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
  console.log("🤖 Agentic Wallet - Create Agents Demo\n");

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

  console.log(`Cluster: ${config.cluster}`);
  console.log(`RPC: ${config.rpcUrl}\n`);

  // Create wallets
  const labels = ["DCA Agent", "Rebalance Agent", "Arb Scanner"];
  const wallets = [];

  for (const label of labels) {
    const policy = PolicyEngine.createDevnetPolicy(
      `${label.toLowerCase()}-policy`,
    );
    const wallet = await walletService.createWallet(label, policy);
    wallets.push(wallet);
    console.log(`✓ Created: ${wallet.label}`);
    console.log(`  ID:  ${wallet.id}`);
    console.log(`  Key: ${wallet.publicKey}\n`);
  }

  console.log("─".repeat(50));
  console.log(`\n✅ Created ${wallets.length} agent wallets.`);
  console.log("\nNext step: Fund wallets with devnet SOL:");
  console.log("  npx tsx demo/02-fund-agents.ts");
  console.log("\nWallet IDs saved to audit log.");
}

main().catch(console.error);
