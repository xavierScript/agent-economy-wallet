/**
 * services.ts
 *
 * Bootstraps all wallet-core services shared by every TUI view and hook.
 * Identical pattern to the MCP server — single source of truth.
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
