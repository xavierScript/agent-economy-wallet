/**
 * tools/index.ts
 *
 * Barrel that registers every MCP tool on the server.
 * Add new tools here — one import + one call.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WalletServices } from "../services.js";

import { registerCreateWalletTool } from "./wallet/create-wallet.js";
import { registerListWalletsTool } from "./wallet/list-wallets.js";
import { registerGetBalanceTool } from "./wallet/get-balance.js";
// close-wallet is intentionally NOT registered here.
// Wallet closure is a destructive, irreversible operation and must only be
// initiated by a human via the CLI. Agents must never be able to close wallets.
import { registerGetAuditLogsTool } from "./wallet/get-audit-logs.js";
import { registerGetStatusTool } from "./wallet/get-status.js";
import { registerGetPolicyTool } from "./wallet/get-policy.js";
import { registerSendSolTool } from "./transfers/send-sol.js";
import { registerSendTokenTool } from "./transfers/send-token.js";
import { registerWriteMemoTool } from "./transfers/write-memo.js";
import { registerMintTokenTool } from "./tokens/mint-token.js";

// payments/
import { registerPayX402Tool } from "./payments/pay-x402.js";
import { registerProbeX402Tool } from "./payments/probe-x402.js";

// merchant/
import { registerFetchPricesTool } from "./merchant/fetch-prices.js";
import { registerAnalyzeTokenSecurityTool } from "./merchant/analyze-token-security.js";

// discovery/ — buyer agent tools for finding and evaluating merchants
import { registerDiscoverRegistryTool } from "./discovery/discover-registry.js";
import { registerReadManifestTool } from "./discovery/read-manifest.js";
import { registerCheckReputationTool } from "./discovery/check-reputation.js";

/**
 * Register all wallet tools on the given MCP server instance.
 */
export function registerAllTools(
  server: McpServer,
  services: WalletServices,
): void {
  registerCreateWalletTool(server, services);
  registerListWalletsTool(server, services);
  registerGetBalanceTool(server, services);
  // registerCloseWalletTool is deliberately omitted — human-only via CLI.
  registerSendSolTool(server, services);
  registerSendTokenTool(server, services);
  registerWriteMemoTool(server, services);
  registerMintTokenTool(server, services);
  registerGetAuditLogsTool(server, services);
  registerGetStatusTool(server, services);
  registerGetPolicyTool(server, services);

  // payments/ — x402 HTTP payment protocol
  registerPayX402Tool(server, services);
  registerProbeX402Tool(server, services);

  // merchant/ — premium tools
  registerFetchPricesTool(server, services);
  registerAnalyzeTokenSecurityTool(server, services);

  // discovery/ — buyer agent tools (read-only, no payment)
  registerDiscoverRegistryTool(server, services);
  registerReadManifestTool(server, services);
  registerCheckReputationTool(server, services);
}
