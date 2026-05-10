/**
 * protocols/index.ts
 *
 * Barrel re-exports for all on-chain protocol integrations.
 * Includes SPL Token operations, Jupiter DEX swaps, and
 * high-level transaction builders.
 */

export { SplTokenService, type TokenAccountInfo } from "./spl-token.js";
export { TransactionBuilder } from "./transaction-builder.js";
export { WELL_KNOWN_TOKENS } from "./well-known-tokens.js";
export { X402ServerService, withX402Paywall } from "./x402-server.js";
export {
  X402Client,
  type PaymentRequirements,
  type PaymentRequired,
  type PaymentPayload,
  type SettlementResponse,
  type X402PaymentResult,
  type X402ClientConfig,
} from "./x402-client.js";
export {
  KoraService,
  type KoraServiceConfig,
  type KoraPayerInfo,
  type KoraNodeConfig,
  type KoraSignAndSendResult,
  type KoraSignResult,
} from "./kora-service.js";
export {
  discoverRegistry,
  buildRegistrationTx,
  getRegistryAddress,
  type AgentMemo,
  type DiscoveredAgent,
} from "./registry-protocol.js";
export {
  StreamingPaymentService,
  type StreamSession,
  type StreamSessionResult,
} from "./streaming-payment-service.js";

