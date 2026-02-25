#!/usr/bin/env node

/**
 * @agentic-wallet/mcp-server
 *
 * MCP (Model Context Protocol) server that exposes Solana agentic wallet
 * operations as tools for AI agents. Run this server and connect any
 * MCP-compatible client (Claude Desktop, VS Code, Cursor, etc.) to give
 * AI agents the ability to create wallets, send transactions, and more.
 *
 * Transport: stdio (default for local MCP servers)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServices } from "./services.js";
import { registerAllTools } from "./tools/index.js";

// ── Bootstrap ────────────────────────────────────────────────────────────────

const services = createServices();

const server = new McpServer(
  {
    name: "agentic-wallet",
    version: "1.0.0",
  },
  {
    capabilities: {
      logging: {},
    },
  },
);

// ── Register tools ───────────────────────────────────────────────────────────

registerAllTools(server, services);

// ── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
