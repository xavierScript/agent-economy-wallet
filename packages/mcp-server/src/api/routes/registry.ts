import { Express, Request, Response } from "express";
import { discoverRegistry } from "@agent-economy-wallet/core";
import type { WalletServices } from "../../services.js";

/**
 * Registry — reads from the decentralised on-chain registry (SPL Memo)
 */
export function registerRegistryRoute(app: Express, services: WalletServices) {
  app.get("/registry", async (_req: Request, res: Response) => {
    try {
      const conn = services.connection.getConnection();
      const agents = await discoverRegistry(conn, 100);

      res.json({
        version: "1",
        source: "on-chain (Solana SPL Memo)",
        updated_at: new Date().toISOString(),
        total_agents: agents.length,
        agents,
      });
    } catch (err: any) {
      res.status(500).json({
        error: "Failed to query on-chain registry",
        details: err.message,
      });
    }
  });
}
