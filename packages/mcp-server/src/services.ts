/**
 * services.ts
 *
 * Bootstraps all wallet-core services used by the MCP tools.
 * Centralised here so every tool file receives the same shared instances.
 */

import {
  KeyManager,
  WalletService,
  PolicyEngine,
  AuditLogger,
  SolanaConnection,
  TransactionBuilder,
  SplTokenService,
  getDefaultConfig,
  type AgentWalletConfig,
} from "@agentic-wallet/core";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WalletServices {
  config: AgentWalletConfig;
  connection: SolanaConnection;
  keyManager: KeyManager;
  policyEngine: PolicyEngine;
  auditLogger: AuditLogger;
  walletService: WalletService;
  txBuilder: TransactionBuilder;
  splTokenService: SplTokenService;
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * Create and return every service the MCP tools depend on.
 * Called once at startup so all tool handlers share the same instances.
 */
export function createServices(): WalletServices {
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

  return {
    config,
    connection,
    keyManager,
    policyEngine,
    auditLogger,
    walletService,
    txBuilder,
    splTokenService,
  };
}
