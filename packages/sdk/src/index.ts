/**
 * agent-economy-wallet — Root SDK entry point
 *
 * This file re-exports the public API from workspace packages so that
 * consumers can use a single import:
 *
 *   import { AgentWallet, x402Paywall, discoverRegistry } from 'agent-economy-wallet';
 *
 * Three developer personas this SDK serves:
 *
 * 1. **Merchant** — has a skill or data source to monetise. Uses
 *    `createX402Paywall()` to gate endpoints, `buildRegistrationTx()` to
 *    get discovered on-chain.
 *
 * 2. **Buyer agent** — autonomous agent that consumes paid services.
 *    Uses `AgentWallet` (WalletService) to manage funds, `discoverRegistry()`
 *    to find merchants, `X402Client` to pay for data.
 *
 * 3. **Hybrid** — an agent that sells one service and buys others.
 *    Uses the full SDK surface to create a self-sustaining node in the
 *    agent economy network.
 */

// ── Core wallet & key management ────────────────────────────────────────────
export {
  WalletService as AgentWallet,
  type WalletInfo,
  type TransactionResult,
} from "@agent-economy-wallet/core";
export { KeyManager, type KeystoreEntry } from "@agent-economy-wallet/core";
export {
  PolicyEngine,
  type Policy,
  type PolicyRule,
  HUMAN_ONLY,
  type HumanOnlyOpts,
} from "@agent-economy-wallet/core";
export { AuditLogger, type AuditLogEntry } from "@agent-economy-wallet/core";
export {
  type AgentWalletConfig,
  getDefaultConfig,
} from "@agent-economy-wallet/core";
export {
  createCoreServices,
  type CoreServices,
} from "@agent-economy-wallet/core";
export { SolanaConnection } from "@agent-economy-wallet/core";

// ── Protocols ───────────────────────────────────────────────────────────────
export {
  TransactionBuilder,
  SplTokenService,
  type TokenAccountInfo,
  WELL_KNOWN_TOKENS,
  X402Client,
  type PaymentRequirements,
  type PaymentRequired,
  type PaymentPayload,
  type SettlementResponse,
  type X402PaymentResult,
  type X402ClientConfig,
  X402ServerService,
  withX402Paywall,
} from "@agent-economy-wallet/core";

// ── On-chain agent registry (SPL Memo) ──────────────────────────────────────
export {
  discoverRegistry,
  buildRegistrationTx,
  getRegistryAddress,
  type AgentMemo,
  type DiscoveredAgent,
} from "@agent-economy-wallet/core";

// ── Gasless relay ───────────────────────────────────────────────────────────
export {
  MasterFunder,
  type MasterFunderConfig,
} from "@agent-economy-wallet/core";
export {
  KoraService,
  type KoraServiceConfig,
  type KoraPayerInfo,
  type KoraNodeConfig,
  type KoraSignAndSendResult,
  type KoraSignResult,
} from "@agent-economy-wallet/core";

// ── Express middleware (for merchants) ──────────────────────────────────────
export { createX402Paywall } from "@agent-economy-wallet/mcp-server/api/server";
