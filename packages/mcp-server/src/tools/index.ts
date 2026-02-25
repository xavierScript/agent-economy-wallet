/**
 * tools/index.ts
 *
 * Barrel that registers every MCP tool on the server.
 * Add new tools here — one import + one call.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WalletServices } from "../services.js";

import { registerCreateWalletTool } from "./create-wallet.js";
import { registerListWalletsTool } from "./list-wallets.js";
import { registerGetBalanceTool } from "./get-balance.js";
import { registerSendSolTool } from "./send-sol.js";
import { registerSendTokenTool } from "./send-token.js";
import { registerGetAuditLogsTool } from "./get-audit-logs.js";
import { registerGetStatusTool } from "./get-status.js";
import { registerGetPolicyTool } from "./get-policy.js";

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
  registerSendSolTool(server, services);
  registerSendTokenTool(server, services);
  registerGetAuditLogsTool(server, services);
  registerGetStatusTool(server, services);
  registerGetPolicyTool(server, services);
}
