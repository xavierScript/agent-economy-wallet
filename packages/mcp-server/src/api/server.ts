import express from "express";
import type { WalletServices } from "../services.js";

import {
  registerManifestRoute,
  registerReputationRoute,
  registerRegistryRoute,
  registerAnalyzeTokenRoute,
  registerFetchPriceRoute,
} from "./routes/index.js";

// Re-export middleware for backward compatibility with root index.ts
export { createX402Paywall } from "./middleware/x402-paywall.js";

// ── Express App Factory ──────────────────────────────────────────────────────

export function createExpressApp(services: WalletServices): express.Express {
  const app = express();

  app.use(express.json());

  // Health check routes
  app.get("/", (req, res) => res.json({ status: "ok", service: "agent-economy-wallet" }));
  app.get("/health", (req, res) => res.json({ status: "ok" }));

  // Register all routes
  registerManifestRoute(app, services);
  registerReputationRoute(app, services);
  registerRegistryRoute(app, services);
  registerAnalyzeTokenRoute(app, services);
  registerFetchPriceRoute(app, services);

  return app;
}
