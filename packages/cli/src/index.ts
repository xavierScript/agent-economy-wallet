#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import {
  KeyManager,
  WalletService,
  PolicyEngine,
  AuditLogger,
  SolanaConnection,
  TransactionBuilder,
  JupiterClient,
  DevnetSwapClient,
  SplTokenService,
  getDefaultConfig,
} from "@agentic-wallet/core";
import type { ISwapClient } from "@agentic-wallet/core";
import { AgentOrchestrator } from "@agentic-wallet/agent-engine";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

// --- Bootstrap ---
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
const splTokenService = new SplTokenService(connection);

// Use DevnetSwapClient on devnet, JupiterClient on mainnet
let swapClient: ISwapClient;
if (config.cluster === "devnet") {
  const devnetSwap = new DevnetSwapClient(connection);
  // Pool will be lazily initialized on first swap
  swapClient = devnetSwap;
} else {
  swapClient = new JupiterClient(config.jupiterApiUrl);
}

const orchestrator = new AgentOrchestrator(walletService, swapClient);

const program = new Command();

program
  .name("agentic-wallet")
  .description(
    chalk.bold("🤖 Solana Agentic Wallet - AI agents with autonomous wallets"),
  )
  .version("0.1.0");

// =============================================
// WALLET COMMANDS
// =============================================

const walletCmd = program.command("wallet").description("Manage agent wallets");

walletCmd
  .command("create")
  .description("Create a new agent wallet")
  .option("-l, --label <label>", "Wallet label", "agent-wallet")
  .option("--policy", "Attach devnet safety policy", true)
  .action(async (opts) => {
    const spinner = ora("Creating wallet...").start();
    try {
      const policy = opts.policy
        ? PolicyEngine.createDevnetPolicy()
        : undefined;
      const wallet = await walletService.createWallet(opts.label, policy);
      spinner.succeed(chalk.green("Wallet created!"));
      console.log();
      console.log(chalk.bold("  ID:        "), wallet.id);
      console.log(chalk.bold("  Label:     "), wallet.label);
      console.log(chalk.bold("  Public Key:"), wallet.publicKey);
      console.log(chalk.bold("  Cluster:   "), config.cluster);
      console.log();
      console.log(
        chalk.dim("  Fund with: agentic-wallet wallet airdrop " + wallet.id),
      );
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
    }
  });

walletCmd
  .command("list")
  .description("List all wallets")
  .action(async () => {
    const spinner = ora("Loading wallets...").start();
    try {
      const wallets = await walletService.listWallets();
      spinner.stop();

      if (wallets.length === 0) {
        console.log(
          chalk.yellow(
            "No wallets found. Create one with: agentic-wallet wallet create",
          ),
        );
        return;
      }

      const table = new Table({
        head: ["ID", "Label", "Public Key", "Balance (SOL)"].map((h) =>
          chalk.cyan(h),
        ),
      });

      for (const w of wallets) {
        table.push([
          w.id.substring(0, 8) + "...",
          w.label,
          w.publicKey.substring(0, 20) + "...",
          w.balanceSol.toFixed(4),
        ]);
      }

      console.log(table.toString());
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
    }
  });

walletCmd
  .command("balance <walletId>")
  .description("Get wallet balance")
  .action(async (walletId: string) => {
    const spinner = ora("Fetching balance...").start();
    try {
      const info = await walletService.getWalletInfo(walletId);
      const tokens = await walletService.getTokenBalances(walletId);
      spinner.stop();

      console.log(chalk.bold("\n  Wallet: ") + info.label);
      console.log(chalk.bold("  Public Key: ") + info.publicKey);
      console.log(
        chalk.bold("  SOL: ") + chalk.green(info.balanceSol.toFixed(6)),
      );

      if (tokens.length > 0) {
        console.log(chalk.bold("\n  SPL Tokens:"));
        for (const t of tokens) {
          console.log(`    ${t.mint.substring(0, 12)}... → ${t.uiAmount}`);
        }
      }
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
    }
  });

walletCmd
  .command("airdrop <walletId>")
  .description("Request devnet SOL airdrop")
  .option("-a, --amount <sol>", "Amount of SOL", "1")
  .action(async (walletId: string, opts: { amount: string }) => {
    const spinner = ora(`Requesting ${opts.amount} SOL airdrop...`).start();
    try {
      const sig = await walletService.requestAirdrop(
        walletId,
        parseFloat(opts.amount),
      );
      spinner.succeed(
        chalk.green(`Airdrop received! Signature: ${sig.substring(0, 20)}...`),
      );
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
    }
  });

// =============================================
// SEND COMMANDS
// =============================================

const sendCmd = program.command("send").description("Send SOL or tokens");

sendCmd
  .command("sol <walletId> <to> <amount>")
  .description("Send SOL to an address")
  .action(async (walletId: string, to: string, amount: string) => {
    const spinner = ora(`Sending ${amount} SOL...`).start();
    try {
      const entry = keyManager.loadKeystore(walletId);
      const fromPk = new PublicKey(entry.publicKey);
      const toPk = new PublicKey(to);
      const tx = txBuilder.buildSolTransfer(fromPk, toPk, parseFloat(amount));
      const sig = await walletService.signAndSendTransaction(walletId, tx, {
        action: "sol:transfer",
        details: { to, amount: parseFloat(amount) },
      });
      spinner.succeed(
        chalk.green(`Sent! Signature: ${sig.substring(0, 20)}...`),
      );
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
    }
  });

// =============================================
// SWAP COMMANDS
// =============================================

program
  .command("swap <walletId>")
  .description("Swap tokens via on-chain AMM")
  .requiredOption("--from <mint>", "Input token mint")
  .requiredOption("--to <mint>", "Output token mint")
  .requiredOption(
    "--amount <amount>",
    "Amount of input token (in smallest unit)",
  )
  .option("--slippage <bps>", "Slippage tolerance in basis points", "50")
  .action(async (walletId: string, opts: any) => {
    const spinner = ora("Getting swap quote...").start();
    try {
      // Ensure devnet pool is initialized if on devnet
      if (
        config.cluster === "devnet" &&
        swapClient instanceof DevnetSwapClient
      ) {
        await (swapClient as DevnetSwapClient).loadOrSetup();
      }

      const publicKey = walletService.getPublicKey(walletId);
      const { quote, transaction } = await swapClient.buildSwap({
        inputMint: opts.from,
        outputMint: opts.to,
        amount: parseInt(opts.amount),
        userPublicKey: publicKey,
        slippageBps: parseInt(opts.slippage),
      });

      spinner.text = "Executing swap...";
      const sig = await walletService.signAndSendVersionedTransaction(
        walletId,
        transaction,
        {
          action: "swap:jupiter",
          details: {
            inputMint: opts.from,
            outputMint: opts.to,
            inAmount: quote.inAmount,
            outAmount: quote.outAmount,
          },
        },
      );

      spinner.succeed(chalk.green(`Swap complete!`));
      console.log(
        `  In:  ${quote.inAmount} (${opts.from.substring(0, 12)}...)`,
      );
      console.log(`  Out: ${quote.outAmount} (${opts.to.substring(0, 12)}...)`);
      console.log(`  Sig: ${sig.substring(0, 20)}...`);
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
    }
  });

// =============================================
// AGENT COMMANDS
// =============================================

const agentCmd = program
  .command("agent")
  .description("Manage autonomous agents");

agentCmd
  .command("spawn")
  .description("Spawn a new agent")
  .requiredOption("-n, --name <name>", "Agent name")
  .requiredOption("-w, --wallet <walletId>", "Wallet ID")
  .requiredOption(
    "-s, --strategy <strategy>",
    "Strategy (dca, rebalance, liquidity, arbitrage)",
  )
  .option("-i, --interval <ms>", "Tick interval in ms", "60000")
  .option("-c, --config <json>", "Strategy config JSON", "{}")
  .action(async (opts: any) => {
    const spinner = ora("Spawning agent...").start();
    try {
      const agent = await orchestrator.spawnAgent({
        name: opts.name,
        walletId: opts.wallet,
        strategyName: opts.strategy,
        strategyConfig: JSON.parse(opts.config),
        tickIntervalMs: parseInt(opts.interval),
      });
      spinner.succeed(chalk.green(`Agent spawned!`));
      console.log(`  ID:       ${agent.id}`);
      console.log(`  Name:     ${agent.name}`);
      console.log(`  Strategy: ${agent.getStrategyName()}`);
      console.log(`  Wallet:   ${agent.walletId}`);
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
    }
  });

agentCmd
  .command("list")
  .description("List all agents")
  .action(() => {
    const agents = orchestrator.listAgents();
    if (agents.length === 0) {
      console.log(chalk.yellow("No agents running."));
      return;
    }

    const table = new Table({
      head: ["ID", "Name", "Strategy", "Status", "Ticks"].map((h) =>
        chalk.cyan(h),
      ),
    });

    for (const a of agents) {
      const statusColor =
        a.status === "running"
          ? chalk.green
          : a.status === "error"
            ? chalk.red
            : chalk.yellow;
      table.push([
        a.id.substring(0, 8) + "...",
        a.name,
        a.strategy,
        statusColor(a.status),
        String(a.tickCount),
      ]);
    }

    console.log(table.toString());
  });

agentCmd
  .command("stop <agentId>")
  .description("Stop an agent")
  .action(async (agentId: string) => {
    const spinner = ora("Stopping agent...").start();
    try {
      await orchestrator.removeAgent(agentId);
      spinner.succeed(chalk.green("Agent stopped and removed."));
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
    }
  });

// =============================================
// STATUS COMMAND
// =============================================

program
  .command("status")
  .description("Show overall system status")
  .action(async () => {
    console.log(chalk.bold("\n🤖 Agentic Wallet Status\n"));
    console.log(chalk.bold("  Cluster: ") + config.cluster);
    console.log(chalk.bold("  RPC:     ") + config.rpcUrl);

    const wallets = await walletService.listWallets();
    console.log(chalk.bold("  Wallets: ") + wallets.length);

    const agents = orchestrator.listAgents();
    console.log(chalk.bold("  Agents:  ") + agents.length);
    console.log(
      chalk.bold("  Running: ") +
        agents.filter((a) => a.status === "running").length,
    );

    const logs = auditLogger.readRecentLogs(5);
    if (logs.length > 0) {
      console.log(chalk.bold("\n  Recent Activity:"));
      for (const log of logs) {
        const icon = log.success ? chalk.green("✓") : chalk.red("✗");
        console.log(`    ${icon} ${log.action} ${chalk.dim(log.timestamp)}`);
      }
    }
    console.log();
  });

// =============================================
// LOGS COMMAND
// =============================================

program
  .command("logs")
  .description("View audit logs")
  .option("-n, --count <count>", "Number of entries", "20")
  .option("-w, --wallet <walletId>", "Filter by wallet ID")
  .action((opts: any) => {
    const count = parseInt(opts.count);
    const logs = opts.wallet
      ? auditLogger.readWalletLogs(opts.wallet, count)
      : auditLogger.readRecentLogs(count);

    if (logs.length === 0) {
      console.log(chalk.yellow("No logs found."));
      return;
    }

    for (const log of logs) {
      const icon = log.success ? chalk.green("✓") : chalk.red("✗");
      const time = chalk.dim(log.timestamp);
      console.log(
        `${icon} [${time}] ${chalk.bold(log.action)} ${log.walletId ? chalk.dim("wallet:" + log.walletId.substring(0, 8)) : ""}`,
      );
      if (log.txSignature) {
        console.log(
          `  ${chalk.dim("tx: " + log.txSignature.substring(0, 32) + "...")}`,
        );
      }
      if (log.error) {
        console.log(`  ${chalk.red(log.error)}`);
      }
    }
  });

// Parse args
program.parse();
