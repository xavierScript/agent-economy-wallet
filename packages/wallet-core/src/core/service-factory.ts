/**
 * service-factory.ts
 *
 * Single-source-of-truth factory for all wallet-core services.
 * Both the CLI and MCP server import from here to avoid duplication.
 */

import { KeyManager } from "./key-manager.js";
import { WalletService } from "./wallet-service.js";
import { PolicyEngine } from "../guardrails/policy-engine.js";
import { AuditLogger } from "./audit-logger.js";
import { SolanaConnection } from "./connection.js";
import { TransactionBuilder } from "../protocols/transaction-builder.js";
import { SplTokenService } from "../protocols/spl-token.js";
import { MasterFunder } from "./master-funder.js";
import { KoraService } from "../protocols/kora-service.js";
import { X402ServerService } from "../protocols/x402-server.js";
import { StreamingPaymentService } from "../protocols/streaming-payment-service.js";
import { getDefaultConfig, type AgentWalletConfig } from "./config.js";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Core services shared by every consumer (CLI, MCP, tests, etc.).
 */
export interface CoreServices {
  config: AgentWalletConfig;
  connection: SolanaConnection;
  keyManager: KeyManager;
  policyEngine: PolicyEngine;
  auditLogger: AuditLogger;
  walletService: WalletService;
  txBuilder: TransactionBuilder;
  splTokenService: SplTokenService;
  /** null when MASTER_WALLET_SECRET_KEY is not set */
  masterFunder: MasterFunder | null;
  /** null when KORA_RPC_URL is not set */
  koraService: KoraService | null;
  x402Server: X402ServerService;
  /** null when YANGA_STREAM_PROGRAM_ID is not set */
  streamingPayment: StreamingPaymentService | null;
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create and return every core wallet service.
 * Called once at startup so all consumers share the same instances.
 */
export function createCoreServices(): CoreServices {
  const config = getDefaultConfig();
  const connection = new SolanaConnection(config.rpcUrl, config.cluster);
  const keyManager = new KeyManager(config.keystoreDir, config.passphrase);

  const home = process.env.HOME || process.env.USERPROFILE || ".";
  const policyEngine = new PolicyEngine(`${home}/.agent-economy-wallet/policies`);

  const auditLogger = new AuditLogger(config.logDir);

  // Master funder — prefer encrypted keystore label over raw env key
  let masterFunder: MasterFunder | null = null;
  if (config.masterWalletKeyLabel) {
    // Secure path: key was imported once via `pnpm key:import` and lives in
    // the AES-256-GCM keystore — no raw secret ever in env at runtime.
    const keypair = keyManager.unlockByLabel(config.masterWalletKeyLabel);
    if (keypair) {
      masterFunder = MasterFunder.fromKeypair(
        keypair,
        config.agentSeedSol,
        connection,
        auditLogger,
      );
    } else {
      console.warn(
        `\x1b[33m⚠  MASTER_WALLET_KEY_LABEL="${config.masterWalletKeyLabel}" not found in keystore. ` +
          `Run \`pnpm key:import\` to import the key, or check the label. Auto-funding disabled.\x1b[0m`,
      );
    }
  } else {
    // Legacy / fallback path: raw base58 key from MASTER_WALLET_SECRET_KEY env var.
    masterFunder = MasterFunder.create(
      config.masterWalletSecretKey,
      config.agentSeedSol,
      connection,
      auditLogger,
    );
  }

  // Kora gasless relay — returns null when KORA_RPC_URL is not set
  const koraService = KoraService.create(config.koraRpcUrl, config.koraApiKey);

  const walletService = new WalletService(
    keyManager,
    policyEngine,
    auditLogger,
    connection,
    masterFunder,
    koraService,
  );

  const txBuilder = new TransactionBuilder(connection);
  const splTokenService = new SplTokenService(connection);
  const x402Server = new X402ServerService(connection.getConnection(), auditLogger);

  // Streaming payments via MagicBlock ER — shares program ID with reputation
  let streamingPayment: StreamingPaymentService | null = null;
  try {
    streamingPayment = new StreamingPaymentService(
      walletService,
      keyManager,
      txBuilder,
      policyEngine,
      auditLogger,
      connection,
    );
  } catch (err: any) {
    console.warn(
      `\x1b[33m⚠  StreamingPaymentService disabled: ${err.message}\x1b[0m`,
    );
  }

  return {
    config,
    connection,
    keyManager,
    policyEngine,
    auditLogger,
    walletService,
    txBuilder,
    splTokenService,
    masterFunder,
    koraService,
    x402Server,
    streamingPayment,
  };
}
