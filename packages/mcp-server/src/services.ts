/**
 * services.ts
 *
 * Extends the shared core service factory with MCP-specific services
 * (e.g. JupiterService).  Tool files receive this augmented bag.
 */

import {
  createCoreServices,
  type CoreServices,
  JupiterService,
} from "@agentic-wallet/core";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WalletServices extends CoreServices {
  jupiterService: JupiterService;
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * Create core services + MCP-specific extras.
 * Called once at startup so all tool handlers share the same instances.
 */
export function createServices(): WalletServices {
  const core = createCoreServices();

  const jupiterService = new JupiterService({
    defaultSlippageBps: 50,
    maxSlippageBps: 300,
    maxPriceImpactPct: 5,
  });

  return { ...core, jupiterService };
}
