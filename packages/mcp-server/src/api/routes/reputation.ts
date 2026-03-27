import { Express, Request, Response } from "express";
import type { WalletServices } from "../../services.js";

/**
 * Reputation endpoint — aggregates audit log into a public trust signal
 */
export function registerReputationRoute(
  app: Express,
  services: WalletServices,
) {
  app.get("/reputation", (_req: Request, res: Response) => {
    const merchantAddress =
      services.config.merchantReceiverAddress ||
      services.config.ownerAddress ||
      "NOT_CONFIGURED";

    // Read all recent audit logs (last 7 days by default)
    const logs = services.auditLogger.readRecentLogs(10000);

    // Filter to x402 verification events (actual completed payments)
    const paymentLogs = logs.filter(
      (e) =>
        e.action === "x402:server:verified" ||
        e.action === "x402:server:failed",
    );
    const successful = paymentLogs.filter((e) => e.success);
    const total = paymentLogs.length;
    const successRate =
      total > 0 ? ((successful.length / total) * 100).toFixed(1) + "%" : "N/A";

    // Estimate total USDC earned from successful payments
    let totalEarnedUsdc = 0;
    for (const entry of successful) {
      const amount = (entry.details as any)?.amount;
      if (typeof amount === "number") {
        // amount is in raw units (e.g. 50000 = 0.05 USDC with 6 decimals)
        totalEarnedUsdc += amount / 1_000_000;
      }
    }

    // Find the earliest log entry for uptime
    const earliest = logs.length > 0 ? logs[logs.length - 1] : null;

    res.json({
      merchant: merchantAddress,
      total_transactions: total,
      successful: successful.length,
      success_rate: successRate,
      total_earned_usdc: Math.round(totalEarnedUsdc * 100) / 100,
      uptime_since: earliest?.timestamp || new Date().toISOString(),
    });
  });
}
