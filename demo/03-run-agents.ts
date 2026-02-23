/**
 * Demo Step 3: Run Agent Strategies
 *
 * Spawns agents with different strategies and lets them run for a short demo period.
 * Uses DevnetSwapClient for real on-chain token swaps on devnet.
 */

import {
  KeyManager,
  WalletService,
  PolicyEngine,
  AuditLogger,
  SolanaConnection,
  DevnetSwapClient,
  getDefaultConfig,
} from "@agentic-wallet/core";
import { AgentOrchestrator } from "@agentic-wallet/agent-engine";

async function main() {
  console.log("🤖 Agentic Wallet - Run Agents Demo\n");

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

  // Initialize DevnetSwapClient with real on-chain AMM pool
  console.log("Setting up devnet AMM pool...");
  const swapClient = new DevnetSwapClient(connection);
  await swapClient.loadOrSetup();
  console.log("✅ Devnet AMM pool ready!\n");

  const orchestrator = new AgentOrchestrator(walletService, swapClient);

  const wallets = await walletService.listWallets();

  if (wallets.length < 3) {
    console.log("❌ Need at least 3 wallets. Run 01-create-agents.ts first.");
    return;
  }

  // Get the test-USDC mint address from the pool
  const testUsdcMint = swapClient.getTestMint();
  console.log(`Using test-USDC: ${testUsdcMint}\n`);

  // Subscribe to events
  orchestrator.onEvent((event) => {
    const time = new Date(event.timestamp).toLocaleTimeString();
    console.log(
      `  [${time}] ${event.type}: ${JSON.stringify(event.data).substring(0, 100)}`,
    );
  });

  // Spawn DCA agent
  console.log("Spawning DCA Agent...");
  await orchestrator.spawnAgent({
    name: "SOL→USDC DCA",
    walletId: wallets[0].id,
    strategyName: "dca",
    strategyConfig: {
      inputMint: "So11111111111111111111111111111111111111112",
      outputMint: testUsdcMint,
      amountPerSwap: 50_000_000, // 0.05 SOL
      intervalMs: 15_000,
    },
    tickIntervalMs: 10_000,
  });

  // Spawn Rebalance agent
  console.log("Spawning Rebalance Agent...");
  await orchestrator.spawnAgent({
    name: "Portfolio 60/40",
    walletId: wallets[1].id,
    strategyName: "rebalance",
    strategyConfig: {
      targets: [
        {
          mint: "So11111111111111111111111111111111111111112",
          targetWeight: 0.6,
        },
        {
          mint: testUsdcMint,
          targetWeight: 0.4,
        },
      ],
      driftThreshold: 5,
      intervalMs: 20_000,
    },
    tickIntervalMs: 15_000,
  });

  // Spawn Arbitrage scanner
  console.log("Spawning Arbitrage Scanner...");
  await orchestrator.spawnAgent({
    name: "SOL/USDC Arb",
    walletId: wallets[2].id,
    strategyName: "arbitrage",
    strategyConfig: {
      tokenMint: testUsdcMint,
      minProfitBps: 30,
      tradeAmount: 100_000_000,
      intervalMs: 10_000,
    },
    tickIntervalMs: 8_000,
  });

  console.log("\n─".repeat(25));
  console.log("\n🚀 All agents running! Watching for 60 seconds...\n");

  // Run for 60 seconds
  await new Promise((r) => setTimeout(r, 60_000));

  console.log("\n─".repeat(25));

  // Print summary
  const agents = orchestrator.listAgents();
  console.log("\n📊 Agent Summary:\n");
  for (const agent of agents) {
    console.log(`  ${agent.name}: ${agent.status} (${agent.tickCount} ticks)`);
  }

  // Stop all
  await orchestrator.stopAll();
  console.log("\n✅ All agents stopped.");
  console.log("\nNext step: View the audit logs:");
  console.log("  npx tsx demo/04-observe.ts");

  // Force exit — lingering timers from agent ticks can keep the process alive
  process.exit(0);
}

main().catch(console.error);
