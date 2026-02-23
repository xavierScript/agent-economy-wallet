/**
 * Demo Step 2: Fund Agent Wallets
 *
 * Requests devnet SOL airdrops and mints test-USDC tokens for all agent wallets.
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
import { PublicKey } from "@solana/web3.js";

async function main() {
  console.log("🤖 Agentic Wallet - Fund Agents Demo\n");

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

  const wallets = await walletService.listWallets();

  if (wallets.length === 0) {
    console.log("❌ No wallets found. Run 01-create-agents.ts first.");
    return;
  }

  // Initialize devnet AMM pool (creates test-USDC mint + pool authority)
  console.log("Setting up devnet AMM pool...");
  const swapClient = new DevnetSwapClient(connection);
  await swapClient.loadOrSetup();
  const testMint = swapClient.getTestMint();
  console.log(`✅ Pool ready. Test-USDC mint: ${testMint}\n`);

  console.log(`Found ${wallets.length} wallets. Requesting airdrops...\n`);
  console.log(
    "⚠️  Devnet faucet is rate-limited. Requesting 1 SOL per wallet with delays.\n",
  );

  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    try {
      // SOL airdrop
      console.log(
        `Airdropping 1 SOL to ${wallet.label} (${wallet.publicKey.substring(0, 20)}...)...`,
      );
      const sig = await walletService.requestAirdrop(wallet.id, 1);
      console.log(`  ✓ SOL Airdrop: ${sig.substring(0, 20)}...`);

      // Wait to avoid rate limiting
      if (i < wallets.length - 1 || true) {
        console.log("  ⏳ Waiting 15s to avoid rate limiting...");
        await new Promise((r) => setTimeout(r, 15_000));
      }

      // Mint test-USDC to wallet
      console.log(`  Minting 1000 test-USDC to ${wallet.label}...`);
      const mintSig = await swapClient.mintTestTokensTo(
        new PublicKey(wallet.publicKey),
        1000,
      );
      console.log(
        `  ✓ Test-USDC minted: ${mintSig ? mintSig.substring(0, 20) + "..." : "(confirmed)"}`,
      );

      const balance = await walletService.getBalance(wallet.id);
      console.log(`  Balance: ${balance.sol.toFixed(4)} SOL\n`);
    } catch (err: any) {
      console.log(`  ✗ Funding failed: ${err.message}\n`);
    }
  }

  console.log("─".repeat(50));
  console.log("\n✅ Wallets funded with SOL + test-USDC.");
  console.log(`   Test-USDC mint: ${testMint}`);
  console.log("\nNext step: Run agent strategies:");
  console.log("  npx tsx demo/03-run-agents.ts");
}

main().catch(console.error);
