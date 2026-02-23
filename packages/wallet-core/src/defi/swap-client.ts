import type { VersionedTransaction } from "@solana/web3.js";

/**
 * A swap quote returned by any DEX integration.
 */
export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export interface SwapResult {
  txSignature: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
}

/**
 * Protocol-agnostic swap client interface.
 * Implemented by JupiterClient (mainnet) and DevnetSwapClient (devnet).
 */
export interface ISwapClient {
  /** Get a swap quote */
  getQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
  }): Promise<SwapQuote>;

  /** Get a serialized swap transaction from a quote */
  getSwapTransaction(params: {
    quoteResponse: SwapQuote;
    userPublicKey: string;
    wrapUnwrapSOL?: boolean;
  }): Promise<VersionedTransaction>;

  /** Convenience: quote + build tx in one call */
  buildSwap(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    userPublicKey: string;
    slippageBps?: number;
  }): Promise<{ quote: SwapQuote; transaction: VersionedTransaction }>;

  /** Get price of inputMint in terms of outputMint */
  getPrice(
    inputMint: string,
    outputMint: string,
    amount?: number,
  ): Promise<number>;
}
