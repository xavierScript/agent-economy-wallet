import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { AuditLogger } from "../core/audit-logger.js";

export class X402ServerService {
  constructor(
    private connection: Connection,
    private auditLogger?: AuditLogger,
  ) {}

  /**
   * Verifies that a transaction signature corresponds to a successful transfer
   * of a specific SPL token amount to the expected merchant address.
   */
  async verifyPayment(
    signature: string,
    requiredAmount: number,
    requiredMint: string,
    merchantAddress: string,
  ): Promise<boolean> {
    const merchantPubkey = new PublicKey(merchantAddress);
    const mintPubkey = new PublicKey(requiredMint);

    // Derive the expected merchant token account
    const merchantTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      merchantPubkey,
    );

    // Fetch the transaction to verify payment details
    const confirmedTx = await this.connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!confirmedTx) {
      throw new Error(`Transaction ${signature} not found or unconfirmed`);
    }

    if (confirmedTx.meta?.err) {
      throw new Error(`Transaction ${signature} failed on-chain`);
    }

    if (!confirmedTx.meta) {
      throw new Error(`Transaction metadata not available for ${signature}`);
    }

    const postTokenBalances = confirmedTx.meta.postTokenBalances ?? [];
    const preTokenBalances = confirmedTx.meta.preTokenBalances ?? [];

    // Find the recipient's token account in the balance changes
    let amountReceived = 0;
    for (const postBal of postTokenBalances) {
      // Compare the account string or index
      const accountKey =
        confirmedTx.transaction.message.accountKeys[postBal.accountIndex]
          ?.pubkey;
      if (
        postBal.mint === requiredMint &&
        accountKey &&
        accountKey.equals(merchantTokenAccount)
      ) {
        const preBal = preTokenBalances.find(
          (pre) => pre.accountIndex === postBal.accountIndex,
        );
        const postAmount = Number(postBal.uiTokenAmount.amount);
        const preAmount = Number(preBal?.uiTokenAmount.amount ?? "0");
        amountReceived = postAmount - preAmount;
        break;
      }
    }

    if (amountReceived < requiredAmount) {
      throw new Error(
        `Insufficient payment: received ${amountReceived}, expected ${requiredAmount}`,
      );
    }

    return true;
  }
}

/**
 * Middleware for MCP tools to require an x402 payment via Solana.
 */
export function withX402Paywall<
  TArgs extends { receipt_signature?: string },
  TResult,
>(
  serverService: X402ServerService,
  priceStr: string,
  priceRaw: number,
  mintAddress: string,
  merchantAddress: string | undefined,
  handler: (args: TArgs) => Promise<TResult>,
) {
  return async (args: TArgs): Promise<TResult> => {
    // ── Guard: no merchant configured ──────────────────────────────
    if (!merchantAddress) {
      serverService["auditLogger"]?.log({
        action: "x402:server:misconfigured",
        success: false,
        error: "Merchant address is not configured for x402 payments.",
        details: { mint: mintAddress, price: priceStr },
      });
      throw new McpError(
        ErrorCode.InternalError,
        "Merchant address is not configured for x402 payments.",
      );
    }

    // ── Guard: no payment receipt provided (agent is told to pay) ──
    if (!args.receipt_signature) {
      serverService["auditLogger"]?.log({
        action: "x402:server:payment-required",
        success: false,
        error: "402 Payment Required",
        details: {
          merchant: merchantAddress,
          mint: mintAddress,
          amount: priceRaw,
          amountStr: priceStr,
        },
      });
      throw new McpError(
        ErrorCode.InvalidRequest,
        JSON.stringify({
          error: "402 Payment Required",
          payment: {
            recipientWallet: merchantAddress,
            mint: mintAddress,
            amount: priceRaw,
            amountStr: priceStr,
            message: `Please provide a transaction signature in 'receipt_signature' proving payment of ${priceStr} to ${merchantAddress}`,
          },
        }),
      );
    }

    // ── Verify payment on-chain ─────────────────────────────────────
    try {
      await serverService.verifyPayment(
        args.receipt_signature,
        priceRaw,
        mintAddress,
        merchantAddress,
      );
    } catch (e: any) {
      serverService["auditLogger"]?.log({
        action: "x402:server:failed",
        txSignature: args.receipt_signature,
        success: false,
        error: e.message || `Verification failed for signature ${args.receipt_signature}`,
        details: {
          merchant: merchantAddress,
          mint: mintAddress,
          amount: priceRaw,
          amountStr: priceStr,
        },
      });
      throw new McpError(
        ErrorCode.InvalidRequest,
        JSON.stringify({
          error: "Payment verification failed",
          details:
            e.message ||
            `Signature ${args.receipt_signature} is invalid, unconfirmed, or does not satisfy the required ${priceStr} payment to ${merchantAddress}`,
        }),
      );
    }

    // ── Payment verified — log success and invoke handler ───────────
    serverService["auditLogger"]?.log({
      action: "x402:server:verified",
      txSignature: args.receipt_signature,
      success: true,
      details: {
        merchant: merchantAddress,
        mint: mintAddress,
        amount: priceRaw,
        amountStr: priceStr,
      },
    });

    return handler(args);
  };
}
