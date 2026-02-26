/**
 * services.ts
 *
 * Re-exports the shared service factory from @agentic-wallet/core.
 * All TUI views and hooks import WalletServices from this local barrel
 * so internal imports stay short (e.g. "../services.js").
 */

import { createCoreServices, type CoreServices } from "@agentic-wallet/core";

/** CLI-visible service bag — identical to CoreServices. */
export type WalletServices = CoreServices;

/** Bootstrap all services (delegates to wallet-core factory). */
export const createServices: () => WalletServices = createCoreServices;
