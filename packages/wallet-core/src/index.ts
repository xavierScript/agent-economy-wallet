/**
 * @agentic-wallet/core
 * Solana wallet SDK for autonomous AI agents.
 * Provides keypair generation, encrypted storage, transaction signing,
 * policy enforcement, and audit logging.
 */

export { KeyManager, type KeystoreEntry } from "./key-manager.js";
export { WalletService, type WalletInfo } from "./wallet-service.js";
export { PolicyEngine, type Policy, type PolicyRule } from "./policy-engine.js";
export { TransactionBuilder } from "./transaction-builder.js";
export { AuditLogger, type AuditLogEntry } from "./audit-logger.js";
export { JupiterClient, TOKEN_MINTS } from "./defi/jupiter.js";
export type { ISwapClient, SwapQuote, SwapResult } from "./defi/swap-client.js";
export { DevnetSwapClient } from "./defi/devnet-swap.js";
export { SplTokenService } from "./defi/spl-token.js";
export { SolanaConnection } from "./connection.js";
export { type AgentWalletConfig, getDefaultConfig } from "./config.js";
