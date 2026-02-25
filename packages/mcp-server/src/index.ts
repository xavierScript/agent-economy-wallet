#!/usr/bin/env node

/**
 * @agentic-wallet/mcp-server
 *
 * MCP (Model Context Protocol) server that exposes Solana agentic wallet
 * operations as tools for AI agents. Run this server and connect any
 * MCP-compatible client (Claude Desktop, VS Code, Cursor, etc.) to give
 * AI agents the ability to create wallets, send transactions, and more.
 *
 * Transport: stdio (default for local MCP servers)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  KeyManager,
  WalletService,
  PolicyEngine,
  AuditLogger,
  SolanaConnection,
  TransactionBuilder,
  SplTokenService,
  getDefaultConfig,
} from "@agentic-wallet/core";

// ---------------------------------------------------------------------------
// Bootstrap wallet services (same pattern as the CLI)
// ---------------------------------------------------------------------------
const config = getDefaultConfig();
const connection = new SolanaConnection(config.rpcUrl, config.cluster);
const keyManager = new KeyManager(config.keystoreDir, config.passphrase);
const home = process.env.HOME || process.env.USERPROFILE || ".";
const policyEngine = new PolicyEngine(`${home}/.agentic-wallet/policies`);
const auditLogger = new AuditLogger(config.logDir);
const walletService = new WalletService(
  keyManager,
  policyEngine,
  auditLogger,
  connection,
);
const txBuilder = new TransactionBuilder(connection);
const splTokenService = new SplTokenService(connection);

// ---------------------------------------------------------------------------
// Create MCP server
// ---------------------------------------------------------------------------
const server = new McpServer({
  name: "agentic-wallet",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Tool: create_wallet
// ---------------------------------------------------------------------------
server.tool(
  "create_wallet",
  "Create a new Solana wallet with AES-256-GCM encrypted key storage. " +
    "Returns the wallet ID and public key. The wallet is created with a " +
    "devnet safety policy by default (2 SOL per-tx limit, rate limits, etc.).",
  {
    label: z
      .string()
      .optional()
      .default("agent-wallet")
      .describe("Human-readable label for the wallet"),
    attach_policy: z
      .boolean()
      .optional()
      .default(true)
      .describe("Attach the default devnet safety policy"),
  },
  async ({ label, attach_policy }) => {
    const policy = attach_policy
      ? PolicyEngine.createDevnetPolicy()
      : undefined;
    const wallet = await walletService.createWallet(label, policy);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              id: wallet.id,
              label: wallet.label,
              publicKey: wallet.publicKey,
              cluster: config.cluster,
              policyAttached: attach_policy,
              note: "Fund this wallet at https://faucet.solana.com by pasting the public key.",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: list_wallets
// ---------------------------------------------------------------------------
server.tool(
  "list_wallets",
  "List all wallets managed by the agentic wallet system, including their " +
    "IDs, labels, public keys, and current SOL balances.",
  {},
  async () => {
    const wallets = await walletService.listWallets();
    return {
      content: [
        {
          type: "text" as const,
          text:
            wallets.length === 0
              ? "No wallets found. Use create_wallet to create one."
              : JSON.stringify(
                  wallets.map((w) => ({
                    id: w.id,
                    label: w.label,
                    publicKey: w.publicKey,
                    balanceSol: w.balanceSol,
                  })),
                  null,
                  2,
                ),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: get_balance
// ---------------------------------------------------------------------------
server.tool(
  "get_balance",
  "Get the SOL balance and SPL token balances for a specific wallet.",
  {
    wallet_id: z.string().describe("The wallet ID (UUID) to check"),
  },
  async ({ wallet_id }) => {
    const info = await walletService.getWalletInfo(wallet_id);
    const tokens = await walletService.getTokenBalances(wallet_id);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              id: info.id,
              label: info.label,
              publicKey: info.publicKey,
              balanceSol: info.balanceSol,
              balanceLamports: info.balanceLamports,
              tokens: tokens.map((t) => ({
                mint: t.mint,
                amount: t.uiAmount,
                decimals: t.decimals,
              })),
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: send_sol
// ---------------------------------------------------------------------------
server.tool(
  "send_sol",
  "Send SOL from a wallet to a recipient address. The transaction is " +
    "policy-checked before signing (spending limits, rate limits, etc.) " +
    "and recorded in the audit log.",
  {
    wallet_id: z.string().describe("Source wallet ID (UUID)"),
    to: z.string().describe("Recipient Solana address (base58 public key)"),
    amount: z.number().positive().describe("Amount of SOL to send"),
  },
  async ({ wallet_id, to, amount }) => {
    // Validate recipient address
    let toPk: PublicKey;
    try {
      toPk = new PublicKey(to);
    } catch {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: Invalid recipient address "${to}". Must be a valid base58 Solana public key.`,
          },
        ],
        isError: true,
      };
    }

    const entry = keyManager.loadKeystore(wallet_id);
    const fromPk = new PublicKey(entry.publicKey);
    const tx = txBuilder.buildSolTransfer(fromPk, toPk, amount);

    const signature = await walletService.signAndSendTransaction(
      wallet_id,
      tx,
      {
        action: "sol:transfer",
        details: { to, amount },
      },
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              signature,
              from: entry.publicKey,
              to,
              amountSol: amount,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: send_token
// ---------------------------------------------------------------------------
server.tool(
  "send_token",
  "Send SPL tokens from a wallet to a recipient address. Automatically " +
    "creates the recipient's Associated Token Account if it doesn't exist.",
  {
    wallet_id: z.string().describe("Source wallet ID (UUID)"),
    to: z.string().describe("Recipient Solana address (base58 public key)"),
    mint: z.string().describe("Token mint address (base58)"),
    amount: z
      .number()
      .positive()
      .describe("Amount of tokens to send (human-readable, e.g. 10.5)"),
    decimals: z
      .number()
      .int()
      .min(0)
      .max(18)
      .default(6)
      .describe("Token decimals (e.g. 6 for USDC, 9 for SOL)"),
  },
  async ({ wallet_id, to, mint, amount, decimals }) => {
    let toPk: PublicKey;
    let mintPk: PublicKey;
    try {
      toPk = new PublicKey(to);
      mintPk = new PublicKey(mint);
    } catch {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: Invalid address. Both recipient and mint must be valid base58 Solana public keys.",
          },
        ],
        isError: true,
      };
    }

    const entry = keyManager.loadKeystore(wallet_id);
    const fromPk = new PublicKey(entry.publicKey);
    const tx = await txBuilder.buildTokenTransfer(
      fromPk,
      toPk,
      mintPk,
      amount,
      decimals,
    );

    const signature = await walletService.signAndSendTransaction(
      wallet_id,
      tx,
      {
        action: "spl-token:transfer",
        details: { to, mint, amount },
      },
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              signature,
              from: entry.publicKey,
              to,
              mint,
              amount,
              decimals,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: get_audit_logs
// ---------------------------------------------------------------------------
server.tool(
  "get_audit_logs",
  "Retrieve recent audit log entries. Every wallet operation (creation, " +
    "transfers, policy violations, etc.) is recorded in the audit trail.",
  {
    count: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe("Number of log entries to retrieve"),
    wallet_id: z
      .string()
      .optional()
      .describe("Filter logs by wallet ID (optional)"),
  },
  async ({ count, wallet_id }) => {
    const logs = wallet_id
      ? auditLogger.readWalletLogs(wallet_id, count)
      : auditLogger.readRecentLogs(count);

    return {
      content: [
        {
          type: "text" as const,
          text:
            logs.length === 0
              ? "No audit logs found."
              : JSON.stringify(logs, null, 2),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: get_status
// ---------------------------------------------------------------------------
server.tool(
  "get_status",
  "Get the overall system status including cluster, RPC endpoint, wallet count, and recent activity.",
  {},
  async () => {
    const wallets = await walletService.listWallets();
    const recentLogs = auditLogger.readRecentLogs(5);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              cluster: config.cluster,
              rpcUrl: config.rpcUrl,
              walletCount: wallets.length,
              wallets: wallets.map((w) => ({
                id: w.id,
                label: w.label,
                balanceSol: w.balanceSol,
              })),
              recentActivity: recentLogs.map((log) => ({
                action: log.action,
                success: log.success,
                timestamp: log.timestamp,
                walletId: log.walletId,
              })),
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool: get_policy
// ---------------------------------------------------------------------------
server.tool(
  "get_policy",
  "Get the policy attached to a wallet, including spending limits, rate limits, " +
    "and allowed programs. Also returns current transaction statistics.",
  {
    wallet_id: z.string().describe("The wallet ID (UUID) to check"),
  },
  async ({ wallet_id }) => {
    const policy = policyEngine.getPolicy(wallet_id);
    const stats = policyEngine.getTransactionStats(wallet_id);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              walletId: wallet_id,
              policy: policy || "No policy attached",
              currentStats: stats,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
