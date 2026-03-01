/**
 * x402-client.ts
 *
 * Client-side implementation of the x402 payment protocol for Solana (SVM).
 *
 * x402 is an open standard (by Coinbase) for HTTP-native payments. When an
 * HTTP server responds with `402 Payment Required`, this client:
 *   1. Parses the `PAYMENT-REQUIRED` header (Base64-encoded PaymentRequired)
 *   2. Selects the best SVM `PaymentRequirements` the wallet can fulfil
 *   3. Builds and partially signs a Solana `TransferChecked` transaction
 *   4. Retries the original request with the `PAYMENT-SIGNATURE` header
 *
 * The agent never touches raw private keys — signing goes through
 * `WalletService`, which enforces policy checks before any signature.
 *
 * Reference: https://github.com/coinbase/x402
 * SVM spec:  specs/schemes/exact/scheme_exact_svm.md
 */

import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * A single payment option returned by a 402 response.
 */
export interface PaymentRequirements {
  /** Payment scheme — currently only "exact" is supported */
  scheme: "exact";
  /** Network identifier (CAIP-2), e.g. "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" */
  network: string;
  /** Amount in smallest unit (e.g. lamports for SOL, base units for SPL) */
  amount: string;
  /** SPL token mint address (native SOL uses the wrapped SOL mint) */
  asset: string;
  /** Recipient address that receives the payment */
  payTo: string;
  /** Maximum time in seconds the payment is valid */
  maxTimeoutSeconds: number;
  /** Extra SVM-specific fields */
  extra: {
    /** Public key of the fee payer (typically the facilitator) */
    feePayer: string;
  };
  /** Optional human-readable description */
  description?: string;
}

/**
 * Full 402 response payload (Base64-decoded from PAYMENT-REQUIRED header).
 */
export interface PaymentRequired {
  x402Version: number;
  accepts: PaymentRequirements[];
  error?: string;
}

/**
 * Payload sent back to the server in the PAYMENT-SIGNATURE header.
 */
export interface PaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: string;
  payload: {
    /** Base64-encoded serialised partially-signed transaction */
    transaction: string;
  };
}

/**
 * Settlement receipt returned in the PAYMENT-RESPONSE header on success.
 */
export interface SettlementResponse {
  success: boolean;
  transaction: string;
  network: string;
  payer: string;
}

/**
 * Result object returned by `payForResource`.
 */
export interface X402PaymentResult {
  /** Whether the payment + resource fetch succeeded */
  success: boolean;
  /** HTTP status code of the final response */
  httpStatus: number;
  /** Response body (the protected resource) */
  body: string;
  /** Content-Type of the response */
  contentType: string;
  /** Settlement details, if the server returned them */
  settlement?: SettlementResponse;
  /** Payment requirements that were fulfilled */
  paymentRequirements?: PaymentRequirements;
  /** Amount paid (human-readable) */
  amountPaid?: string;
  /** Token used for payment */
  tokenMint?: string;
  /** Error message if something failed */
  error?: string;
}

/**
 * Configuration for the x402 client.
 */
export interface X402ClientConfig {
  /** Preferred network (CAIP-2 format). Defaults to Solana devnet. */
  preferredNetwork?: string;
  /** Whether to automatically retry on 402 (default: true) */
  autoRetry?: boolean;
  /** Maximum payment amount in lamports the client will approve per request */
  maxPaymentLamports?: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Solana devnet CAIP-2 identifier */
const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
/** Solana mainnet CAIP-2 identifier */
const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

/** Native SOL wrapped mint */
const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";

/** Default maximum payment: 1 SOL in lamports */
const DEFAULT_MAX_PAYMENT_LAMPORTS = 1_000_000_000;

// ── x402 Client Service ─────────────────────────────────────────────────────

/**
 * X402Client handles the client side of the x402 payment protocol.
 *
 * Given a URL, it:
 *  1. Makes an initial HTTP request
 *  2. If the server responds 402, parses payment requirements
 *  3. Builds a payment transaction using the agent's wallet
 *  4. Signs via the callback (which goes through WalletService + PolicyEngine)
 *  5. Retries the request with the payment proof attached
 *
 * This class does NOT hold private keys — signing is delegated via callback.
 */
export class X402Client {
  private config: Required<X402ClientConfig>;

  constructor(config: X402ClientConfig = {}) {
    this.config = {
      preferredNetwork: config.preferredNetwork || SOLANA_DEVNET,
      autoRetry: config.autoRetry ?? true,
      maxPaymentLamports:
        config.maxPaymentLamports ?? DEFAULT_MAX_PAYMENT_LAMPORTS,
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Attempt to fetch a resource. If the server responds 402, automatically
   * construct and sign a payment, then retry.
   *
   * @param url        - The HTTP(S) URL to request
   * @param options    - Standard fetch options (method, headers, body …)
   * @param signTx     - Callback that signs a legacy Transaction via WalletService
   * @param walletPublicKey - The payer wallet's base58 public key
   * @returns Payment result with the resource body or error details
   */
  async payForResource(
    url: string,
    options: RequestInit = {},
    signTx: (tx: Transaction) => Promise<Transaction>,
    walletPublicKey: string,
  ): Promise<X402PaymentResult> {
    // ── Step 1: Initial request ──────────────────────────────────────────
    const initialResponse = await fetch(url, options);

    if (initialResponse.status !== 402) {
      // No payment required — return the response as-is
      return {
        success: initialResponse.ok,
        httpStatus: initialResponse.status,
        body: await initialResponse.text(),
        contentType:
          initialResponse.headers.get("content-type") || "text/plain",
      };
    }

    if (!this.config.autoRetry) {
      return {
        success: false,
        httpStatus: 402,
        body: "",
        contentType: "text/plain",
        error: "Server returned 402 Payment Required and autoRetry is disabled",
      };
    }

    // ── Step 2: Parse payment requirements ───────────────────────────────
    const paymentRequired = this.parsePaymentRequired(initialResponse);
    if (!paymentRequired) {
      return {
        success: false,
        httpStatus: 402,
        body: "",
        contentType: "text/plain",
        error: "Server returned 402 but no valid PAYMENT-REQUIRED header found",
      };
    }

    // ── Step 3: Select a compatible payment option ───────────────────────
    const requirements = this.selectRequirements(paymentRequired);
    if (!requirements) {
      return {
        success: false,
        httpStatus: 402,
        body: "",
        contentType: "text/plain",
        error: `No compatible SVM payment option found. Server accepts: ${paymentRequired.accepts
          .map((a) => `${a.scheme}/${a.network}`)
          .join(", ")}`,
      };
    }

    // ── Step 4: Safety check — amount within limits ──────────────────────
    const amountNum = BigInt(requirements.amount);
    if (amountNum > BigInt(this.config.maxPaymentLamports)) {
      return {
        success: false,
        httpStatus: 402,
        body: "",
        contentType: "text/plain",
        error: `Payment amount ${requirements.amount} exceeds max allowed ${this.config.maxPaymentLamports}`,
        paymentRequirements: requirements,
      };
    }

    // ── Step 5: Build the payment transaction ────────────────────────────
    const paymentTx = this.buildPaymentTransaction(
      requirements,
      walletPublicKey,
    );

    // ── Step 6: Sign via WalletService (policy checks happen here) ───────
    let signedTx: Transaction;
    try {
      signedTx = await signTx(paymentTx);
    } catch (err: any) {
      return {
        success: false,
        httpStatus: 402,
        body: "",
        contentType: "text/plain",
        error: `Transaction signing failed: ${err.message}`,
        paymentRequirements: requirements,
      };
    }

    // ── Step 7: Serialize and encode the signed transaction ──────────────
    const serialized = signedTx.serialize({
      requireAllSignatures: false, // fee payer (facilitator) hasn't signed yet
      verifySignatures: false,
    });
    const txBase64 = Buffer.from(serialized).toString("base64");

    // ── Step 8: Build the payment payload ────────────────────────────────
    const paymentPayload: PaymentPayload = {
      x402Version: 2,
      scheme: "exact",
      network: requirements.network,
      payload: {
        transaction: txBase64,
      },
    };

    const paymentSignatureHeader = Buffer.from(
      JSON.stringify(paymentPayload),
    ).toString("base64");

    // ── Step 9: Retry with payment proof ─────────────────────────────────
    const retryHeaders = new Headers(options.headers || {});
    retryHeaders.set("PAYMENT-SIGNATURE", paymentSignatureHeader);

    const paidResponse = await fetch(url, {
      ...options,
      headers: retryHeaders,
    });

    // ── Step 10: Parse settlement response ───────────────────────────────
    let settlement: SettlementResponse | undefined;
    const paymentResponseHeader = paidResponse.headers.get("PAYMENT-RESPONSE");
    if (paymentResponseHeader) {
      try {
        settlement = JSON.parse(
          Buffer.from(paymentResponseHeader, "base64").toString("utf-8"),
        );
      } catch {
        // Settlement header malformed — non-fatal
      }
    }

    const body = await paidResponse.text();

    return {
      success: paidResponse.ok,
      httpStatus: paidResponse.status,
      body,
      contentType: paidResponse.headers.get("content-type") || "text/plain",
      settlement,
      paymentRequirements: requirements,
      amountPaid: requirements.amount,
      tokenMint: requirements.asset,
    };
  }

  // ── Parsing helpers ──────────────────────────────────────────────────────

  /**
   * Extract and decode the PaymentRequired object from a 402 response.
   */
  parsePaymentRequired(response: Response): PaymentRequired | null {
    const header = response.headers.get("PAYMENT-REQUIRED");
    if (!header) return null;

    try {
      const decoded = Buffer.from(header, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded) as PaymentRequired;
      if (!parsed.accepts || !Array.isArray(parsed.accepts)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Select the best matching PaymentRequirements for our wallet.
   * Prefers the configured network and "exact" scheme.
   */
  selectRequirements(
    paymentRequired: PaymentRequired,
  ): PaymentRequirements | null {
    // First try: exact match on preferred network
    const preferred = paymentRequired.accepts.find(
      (r) => r.scheme === "exact" && r.network === this.config.preferredNetwork,
    );
    if (preferred) return preferred;

    // Second try: any SVM network with exact scheme
    const anySvm = paymentRequired.accepts.find(
      (r) => r.scheme === "exact" && r.network.startsWith("solana:"),
    );
    return anySvm || null;
  }

  // ── Transaction building ─────────────────────────────────────────────────

  /**
   * Build the Solana payment transaction per the x402 SVM exact scheme.
   *
   * The transaction contains:
   *   1. ComputeBudget: SetComputeUnitLimit
   *   2. ComputeBudget: SetComputeUnitPrice
   *   3. SPL Token: TransferChecked (or System: Transfer for native SOL)
   *
   * The fee payer is set to the facilitator's address. The transaction is
   * only partially signed (by the client wallet) — the facilitator adds
   * its signature before submitting to the network.
   */
  buildPaymentTransaction(
    requirements: PaymentRequirements,
    walletPublicKey: string,
  ): Transaction {
    const payer = new PublicKey(walletPublicKey);
    const feePayer = new PublicKey(requirements.extra.feePayer);
    const payTo = new PublicKey(requirements.payTo);
    const amount = BigInt(requirements.amount);

    const tx = new Transaction();

    // ── Compute Budget instructions ────────────────────────────────────
    const computeBudgetProgram = new PublicKey(
      "ComputeBudget111111111111111111111111111111",
    );

    // SetComputeUnitLimit (discriminator = 2)
    const limitData = Buffer.alloc(5);
    limitData.writeUInt8(2, 0);
    limitData.writeUInt32LE(200_000, 1);
    tx.add(
      new TransactionInstruction({
        keys: [],
        programId: computeBudgetProgram,
        data: limitData,
      }),
    );

    // SetComputeUnitPrice (discriminator = 3)
    const priceData = Buffer.alloc(9);
    priceData.writeUInt8(3, 0);
    priceData.writeBigUInt64LE(BigInt(1), 1); // 1 microlamport per CU
    tx.add(
      new TransactionInstruction({
        keys: [],
        programId: computeBudgetProgram,
        data: priceData,
      }),
    );

    // ── Payment instruction ────────────────────────────────────────────
    if (requirements.asset === NATIVE_SOL_MINT) {
      // Native SOL transfer via System Program
      tx.add(
        SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey: payTo,
          lamports: Number(amount),
        }),
      );
    } else {
      // SPL Token TransferChecked
      const mint = new PublicKey(requirements.asset);
      const sourceAta = getAssociatedTokenAddressSync(mint, payer);
      const destAta = getAssociatedTokenAddressSync(mint, payTo);

      // For x402 exact scheme, we use TransferChecked with the mint's decimals.
      // The facilitator verifies this matches the PaymentRequirements exactly.
      // We default to 6 decimals (USDC standard) — the facilitator validates.
      tx.add(
        createTransferCheckedInstruction(
          sourceAta,
          mint,
          destAta,
          payer,
          Number(amount),
          6, // decimals — server-specified tokens typically use 6
        ),
      );
    }

    // Fee payer is the facilitator (they sponsor the transaction)
    tx.feePayer = feePayer;

    return tx;
  }

  // ── Utility ──────────────────────────────────────────────────────────────

  /**
   * Check whether a URL requires x402 payment without actually paying.
   * Makes a HEAD/GET request and checks for 402 + valid header.
   */
  async probeResource(url: string): Promise<{
    requiresPayment: boolean;
    paymentRequired?: PaymentRequired;
    svmOptions?: PaymentRequirements[];
  }> {
    const response = await fetch(url, { method: "HEAD" });

    if (response.status !== 402) {
      return { requiresPayment: false };
    }

    const paymentRequired = this.parsePaymentRequired(response);
    if (!paymentRequired) {
      return { requiresPayment: true };
    }

    const svmOptions = paymentRequired.accepts.filter(
      (r) => r.scheme === "exact" && r.network.startsWith("solana:"),
    );

    return {
      requiresPayment: true,
      paymentRequired,
      svmOptions: svmOptions.length > 0 ? svmOptions : undefined,
    };
  }

  /**
   * Format a payment amount for display.
   */
  static formatAmount(amount: string, asset: string): string {
    const value = Number(amount);
    if (asset === NATIVE_SOL_MINT) {
      return `${(value / LAMPORTS_PER_SOL).toFixed(6)} SOL`;
    }
    // Default to 6 decimal places (USDC, USDT, etc.)
    return `${(value / 1_000_000).toFixed(6)} tokens`;
  }

  /**
   * Get the CAIP-2 network identifier for a Solana cluster.
   */
  static getNetworkId(cluster: "devnet" | "testnet" | "mainnet-beta"): string {
    switch (cluster) {
      case "mainnet-beta":
        return SOLANA_MAINNET;
      case "devnet":
        return SOLANA_DEVNET;
      default:
        return `solana:${cluster}`;
    }
  }
}
