import { Request, Response, NextFunction } from "express";
import type { WalletServices } from "../../services.js";

/**
 * Express middleware that enforces x402 payment before granting access.
 * Extracted as a standalone export so SDK consumers can reuse it
 * on their own Express endpoints:
 *
 * ```ts
 * import { createX402Paywall } from 'agent-economy-wallet';
 * app.get('/my-api', createX402Paywall(services, 50_000, USDC_MINT), handler);
 * ```
 */
export function createX402Paywall(
  services: WalletServices,
  priceRaw: number,
  mintAddress: string,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const merchantAddress = services.config.merchantReceiverAddress;

    if (!merchantAddress) {
      return res
        .status(500)
        .json({ error: "Merchant receiver address not configured" });
    }

    const receiptSignature = req.header("x-receipt-signature");

    if (!receiptSignature) {
      const paymentRequired = {
        x402Version: 1,
        accepts: [
          {
            scheme: "exact",
            network: "solana-devnet",
            amount: priceRaw.toString(),
            asset: mintAddress,
            payTo: merchantAddress,
            maxTimeoutSeconds: 3600,
            extra: { feePayer: "" },
          },
        ],
      };

      res.setHeader(
        "X-PAYMENT-REQUIRED",
        Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
      );

      services.auditLogger.log({
        action: "x402:server:payment-required",
        success: false,
        error: "402 Payment Required",
        details: {
          merchant: merchantAddress,
          mint: mintAddress,
          amount: priceRaw,
          endpoint: req.originalUrl,
        },
      });

      return res.status(402).json({
        error: "Payment Required",
        payment: {
          cluster: "devnet",
          mint: mintAddress,
          amount: priceRaw,
          recipient: merchantAddress,
        },
      });
    }

    try {
      await services.x402Server.verifyPayment(
        receiptSignature,
        priceRaw,
        mintAddress,
        merchantAddress,
      );

      services.auditLogger.log({
        action: "x402:server:verified",
        txSignature: receiptSignature,
        success: true,
        details: {
          merchant: merchantAddress,
          mint: mintAddress,
          amount: priceRaw,
          endpoint: req.originalUrl,
        },
      });

      next();
    } catch (error: any) {
      services.auditLogger.log({
        action: "x402:server:failed",
        txSignature: receiptSignature,
        success: false,
        error: error.message || "Payment verification failed",
        details: {
          merchant: merchantAddress,
          mint: mintAddress,
          amount: priceRaw,
          endpoint: req.originalUrl,
        },
      });

      return res.status(400).json({
        error: "Payment verification failed",
        details: error.message,
      });
    }
  };
}
