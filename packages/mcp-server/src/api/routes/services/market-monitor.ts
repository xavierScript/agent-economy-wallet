import { Express, Request, Response } from "express";
import type { WalletServices } from "../../../services.js";

const COINGECKO_PRICE_API = "https://api.coingecko.com/api/v3/simple/price";

/**
 * GET /api/market-monitor?session_id=<sessionId>
 *
 * Real-time market data endpoint — priced per compute second via MagicBlock ER.
 * No x402 paywall — the active streaming session validates payment.
 */
export function registerMarketMonitorRoute(
  app: Express,
  services: WalletServices,
) {
  app.get(
    "/api/market-monitor",
    async (req: Request, res: Response) => {
      const sessionId = req.query.session_id as string | undefined;

      // 1. Missing session_id → 400
      if (!sessionId) {
        return res.status(400).json({
          error:
            "Missing session_id query parameter. Provide the session ID from stream_payment_session.",
        });
      }

      // 2. No active session → 402
      if (!services.streamingPayment) {
        return res.status(402).json({
          error:
            "Streaming payments not configured. Set YANGA_STREAM_PROGRAM_ID.",
        });
      }

      const session = services.streamingPayment.getSession(sessionId);
      if (!session) {
        return res.status(402).json({
          error:
            "No active session. Open a stream_payment_session first.",
        });
      }

      // 3. Active session → fetch price and return 200
      try {
        const params = new URLSearchParams({
          ids: "solana",
          vs_currencies: "usd",
        });
        const priceRes = await fetch(
          `${COINGECKO_PRICE_API}?${params.toString()}`,
        );
        const priceData = (await priceRes.json()) as Record<
          string,
          { usd: number }
        >;
        const solPrice = priceData?.solana?.usd ?? 0;

        const elapsedMs = Date.now() - session.startedAt.getTime();

        return res.json({
          session_id: sessionId,
          tick: session.tickCount,
          total_paid_usdc: session.totalPaid / 1_000_000,
          data: {
            sol_price_usd: solPrice.toString(),
            timestamp: new Date().toISOString(),
            session_elapsed_ms: elapsedMs,
          },
        });
      } catch (error: any) {
        return res.status(502).json({
          error: `Failed to fetch market data: ${error.message}`,
        });
      }
    },
  );
}
