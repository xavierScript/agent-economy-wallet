/**
 * Agentic Wallet — SDK Demo
 *
 * Demonstrates the core capabilities:
 *   1. Create an encrypted wallet programmatically
 *   2. Check SOL & SPL token balances
 *   3. Send SOL to another address (dApp interaction #1)
 *   4. Write an on-chain memo via SPL Memo program (dApp interaction #2)
 *   5. View the audit trail
 *
 * Usage:
 *   1. Run once — it creates a wallet and prints the public key
 *   2. Fund the wallet at https://faucet.solana.com
 *   3. Re-run — it will execute the SOL transfer and memo
 *
 * Run: npx tsx examples/direct-sdk.ts
 */

import {
  KeyManager,
  WalletService,
  PolicyEngine,
  AuditLogger,
  SolanaConnection,
  TransactionBuilder,
  getDefaultConfig,
} from "@agentic-wallet/core";
import { PublicKey } from "@solana/web3.js";

async function main() {
  console.log("═".repeat(55));
  console.log("  Solana Agentic Wallet — SDK Demo");
  console.log("═".repeat(55));

  // ── 1. Initialize SDK ─────────────────────────────────────────
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
  const txBuilder = new TransactionBuilder(connection);

  console.log(`\nCluster: ${config.cluster}`);
  console.log(`RPC:     ${config.rpcUrl}\n`);

  // ── 2. Create a wallet ────────────────────────────────────────
  console.log("── Step 1: Create Wallet ──\n");

  const policy = PolicyEngine.createDevnetPolicy("demo-safety");
  const wallet = await walletService.createWallet("demo-wallet", policy);
  console.log(`  ✓ Wallet created`);
  console.log(`    ID:  ${wallet.id}`);
  console.log(`    Key: ${wallet.publicKey}\n`);

  // ── 3. Check balance ──────────────────────────────────────────
  console.log("── Step 2: Check Balance ──\n");

  const bal = await walletService.getBalance(wallet.id);
  console.log(`  SOL: ${bal.sol.toFixed(4)}`);

  if (bal.sol < 0.01) {
    console.log(
      "\n⚠️  Wallet needs SOL. Fund it at https://faucet.solana.com",
    );
    console.log(`   Paste this address: ${wallet.publicKey}`);
    console.log("   Then re-run this script.\n");
    process.exit(0);
  }

  // ── 4. Send SOL (dApp interaction #1) ─────────────────────────
  console.log("\n── Step 3: Send SOL ──\n");

  // Send a small amount to a known devnet address (ourselves — round-trip)
  const selfPk = new PublicKey(wallet.publicKey);
  const tx = txBuilder.buildSolTransfer(selfPk, selfPk, 0.001);
  const sendSig = await walletService.signAndSendTransaction(wallet.id, tx, {
    action: "sol:transfer",
    details: { to: wallet.publicKey, amount: 0.001 },
  });
  console.log(`  ✓ Sent 0.001 SOL (self-transfer)`);
  console.log(`    Signature: ${sendSig}\n`);

  // ── 5. Write on-chain memo (dApp interaction #2) ──────────────
  console.log("── Step 4: Write On-Chain Memo ──\n");

  const memoMessage = `Agentic Wallet demo — ${new Date().toISOString()}`;
  const memoTx = txBuilder.buildMemo(selfPk, memoMessage);
  const memoSig = await walletService.signAndSendTransaction(
    wallet.id,
    memoTx,
    {
      action: "memo:write",
      details: { message: memoMessage },
    },
  );
  console.log(`  ✓ Memo written on-chain`);
  console.log(`    Message: "${memoMessage}"`);
  console.log(`    Signature: ${memoSig}\n`);

  // ── 6. Send SOL + Memo combo (bonus: atomic multi-instruction) ─
  console.log("── Step 5: SOL Transfer with Memo ──\n");

  const comboTx = txBuilder.buildSolTransferWithMemo(
    selfPk,
    selfPk,
    0.001,
    "payment: demo round-trip",
  );
  const comboSig = await walletService.signAndSendTransaction(
    wallet.id,
    comboTx,
    {
      action: "sol:transfer+memo",
      details: { to: wallet.publicKey, amount: 0.001, memo: "payment: demo round-trip" },
    },
  );
  console.log(`  ✓ SOL transfer + memo in one transaction`);
  console.log(`    Signature: ${comboSig}\n`);

  // ── 7. Final balance & audit trail ────────────────────────────
  console.log("── Step 6: Results ──\n");

  const finalBal = await walletService.getBalance(wallet.id);
  console.log(`  Final SOL: ${finalBal.sol.toFixed(6)}`);

  const tokens = await walletService.getTokenBalances(wallet.id);
  if (tokens.length > 0) {
    console.log("  SPL Tokens:");
    for (const t of tokens) {
      console.log(`    ${t.mint.slice(0, 12)}... → ${t.uiAmount}`);
    }
  }

  console.log("\n  Audit Trail:");
  const logs = auditLogger.readRecentLogs(10);
  for (const log of logs) {
    const icon = log.success ? "✓" : "✗";
    const time = new Date(log.timestamp).toLocaleTimeString();
    console.log(
      `    ${icon} [${time}] ${log.action}${log.txSignature ? ` — ${log.txSignature.slice(0, 24)}...` : ""}`,
    );
  }

  console.log("\n" + "═".repeat(55));
  console.log("  ✅ Demo complete");
  console.log("═".repeat(55));

  process.exit(0);
}

main().catch(console.error);
