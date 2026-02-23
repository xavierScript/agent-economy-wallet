import { VersionedTransaction } from "@solana/web3.js";
import type { ISwapClient, SwapQuote } from "./swap-client.js";

/**
 * Well-known SPL token mints on devnet and mainnet.
 */
export const TOKEN_MINTS = {
  // Mainnet
  SOL: "So11111111111111111111111111111111111111112",
  USDC_MAINNET: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT_MAINNET: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  // Devnet
  USDC_DEVNET: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
} as const;

/**
 * JupiterClient interfaces with the Jupiter Swap API for mainnet token swaps.
 * Implements the ISwapClient interface for use with the agent engine.
 *
 * Note: Jupiter only works on mainnet. For devnet, use DevnetSwapClient instead.
 */
export class JupiterClient implements ISwapClient {
  private apiUrl: string;
  private apiKey: string;

  constructor(
    apiUrl: string = "https://api.jup.ag/swap/v1",
    options?: { apiKey?: string },
  ) {
    this.apiUrl = apiUrl;
    this.apiKey = options?.apiKey || process.env.JUPITER_API_KEY || "";
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }
    return headers;
  }

  async getQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
  }): Promise<SwapQuote> {
    const { inputMint, outputMint, amount, slippageBps = 50 } = params;

    const url = new URL(`${this.apiUrl}/quote`);
    url.searchParams.set("inputMint", inputMint);
    url.searchParams.set("outputMint", outputMint);
    url.searchParams.set("amount", amount.toString());
    url.searchParams.set("slippageBps", slippageBps.toString());

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jupiter quote failed: ${response.status} - ${error}`);
    }

    return response.json() as Promise<SwapQuote>;
  }

  async getSwapTransaction(params: {
    quoteResponse: SwapQuote;
    userPublicKey: string;
    wrapUnwrapSOL?: boolean;
  }): Promise<VersionedTransaction> {
    const { quoteResponse, userPublicKey, wrapUnwrapSOL = true } = params;

    const response = await fetch(`${this.apiUrl}/swap`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: wrapUnwrapSOL,
        computeUnitPriceMicroLamports: "auto",
        dynamicComputeUnitLimit: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jupiter swap failed: ${response.status} - ${error}`);
    }

    const { swapTransaction } = (await response.json()) as {
      swapTransaction: string;
    };
    const txBuf = Buffer.from(swapTransaction, "base64");
    return VersionedTransaction.deserialize(txBuf);
  }

  async buildSwap(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    userPublicKey: string;
    slippageBps?: number;
  }): Promise<{ quote: SwapQuote; transaction: VersionedTransaction }> {
    const quote = await this.getQuote(params);
    const transaction = await this.getSwapTransaction({
      quoteResponse: quote,
      userPublicKey: params.userPublicKey,
    });
    return { quote, transaction };
  }

  async getPrice(
    inputMint: string,
    outputMint: string,
    amount: number = 1_000_000_000,
  ): Promise<number> {
    try {
      const quote = await this.getQuote({ inputMint, outputMint, amount });
      return Number(quote.outAmount) / Number(quote.inAmount);
    } catch {
      return 0;
    }
  }
}
