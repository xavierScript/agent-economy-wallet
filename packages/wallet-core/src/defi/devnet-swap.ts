import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { ISwapClient, SwapQuote } from "./swap-client.js";
import { SolanaConnection } from "../connection.js";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * DevnetSwapClient provides real on-chain token swaps on devnet
 * using a simple constant-product AMM pool managed by a pool authority keypair.
 *
 * How it works:
 * 1. setup() creates a test USDC token on devnet and funds a pool authority
 * 2. The pool authority holds reserves of both SOL and test-USDC
 * 3. Swaps transfer tokens between the user and pool authority wallets
 * 4. Price is derived from the pool's reserve ratio (constant-product formula)
 *
 * This gives us real on-chain signed transactions on devnet — not simulations.
 */
export class DevnetSwapClient implements ISwapClient {
  private solanaConnection: SolanaConnection;
  private poolDir: string;
  private poolAuthority: Keypair | null = null;
  private testMint: PublicKey | null = null;
  private testMintDecimals: number = 6;
  private poolReserveSOL: number = 100; // virtual SOL reserve
  private poolReserveToken: number = 17000; // virtual token reserve (~$170/SOL)
  private initialized = false;

  // SOL native mint
  static readonly SOL_MINT = "So11111111111111111111111111111111111111112";

  constructor(solanaConnection: SolanaConnection, dataDir?: string) {
    this.solanaConnection = solanaConnection;
    const home = process.env.HOME || process.env.USERPROFILE || ".";
    this.poolDir = dataDir || path.join(home, ".agentic-wallet", "devnet-pool");
  }

  /**
   * Get the test USDC mint address (available after setup).
   */
  getTestMint(): string {
    if (!this.testMint)
      throw new Error("Pool not initialized. Call setup() first.");
    return this.testMint.toBase58();
  }

  /**
   * Get the pool authority public key.
   */
  getPoolAuthority(): string {
    if (!this.poolAuthority)
      throw new Error("Pool not initialized. Call setup() first.");
    return this.poolAuthority.publicKey.toBase58();
  }

  /**
   * Check if the pool is already set up.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Load pool state from disk if it exists.
   */
  async loadOrSetup(): Promise<void> {
    const stateFile = path.join(this.poolDir, "pool-state.json");
    if (fs.existsSync(stateFile)) {
      try {
        const state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
        this.poolAuthority = Keypair.fromSecretKey(
          Uint8Array.from(state.poolAuthoritySecret),
        );
        this.testMint = new PublicKey(state.testMint);
        this.testMintDecimals = state.testMintDecimals || 6;
        this.poolReserveSOL = state.poolReserveSOL || 100;
        this.poolReserveToken = state.poolReserveToken || 17000;
        this.initialized = true;
        return;
      } catch {
        // corrupted state, re-setup
      }
    }
    await this.setup();
  }

  /**
   * Set up the devnet pool:
   * 1. Generate pool authority keypair
   * 2. Airdrop SOL to pool authority
   * 3. Create a test SPL token (test-USDC)
   * 4. Mint test tokens to pool authority
   * 5. Save state to disk
   */
  async setup(): Promise<void> {
    const conn = this.solanaConnection.getConnection();

    // Ensure pool dir exists
    fs.mkdirSync(this.poolDir, { recursive: true });

    console.log("🏗️  Setting up devnet swap pool...");

    // 1. Generate pool authority
    this.poolAuthority = Keypair.generate();
    console.log(`  Pool authority: ${this.poolAuthority.publicKey.toBase58()}`);

    // 2. Airdrop SOL to pool authority (retry up to 3 times)
    console.log("  Airdropping SOL to pool authority...");
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const sig = await conn.requestAirdrop(
          this.poolAuthority.publicKey,
          2 * LAMPORTS_PER_SOL,
        );
        await conn.confirmTransaction(sig, "confirmed");
        break;
      } catch (err: any) {
        if (attempt === 2)
          throw new Error(`Pool airdrop failed: ${err.message}`);
        console.log(
          `  Airdrop attempt ${attempt + 1} failed, retrying in 10s...`,
        );
        await new Promise((r) => setTimeout(r, 10_000));
      }
    }

    // 3. Create test USDC mint
    console.log("  Creating test-USDC token...");
    this.testMint = await createMint(
      conn,
      this.poolAuthority,
      this.poolAuthority.publicKey, // mint authority
      this.poolAuthority.publicKey, // freeze authority
      this.testMintDecimals,
    );
    console.log(`  Test-USDC mint: ${this.testMint.toBase58()}`);

    // 4. Create pool's token account and mint initial liquidity
    console.log("  Minting test-USDC to pool...");
    const poolTokenAccount = await getOrCreateAssociatedTokenAccount(
      conn,
      this.poolAuthority,
      this.testMint,
      this.poolAuthority.publicKey,
    );

    // Mint 1,000,000 test-USDC (enough for many demo swaps)
    const mintAmount = 1_000_000 * 10 ** this.testMintDecimals;
    await mintTo(
      conn,
      this.poolAuthority,
      this.testMint,
      poolTokenAccount.address,
      this.poolAuthority,
      BigInt(mintAmount),
    );

    this.initialized = true;

    // 5. Save state
    this.saveState();

    console.log("  ✅ Devnet swap pool ready!");
    console.log(`     SOL reserve: ${this.poolReserveSOL} SOL (virtual)`);
    console.log(
      `     Token reserve: ${this.poolReserveToken} test-USDC (virtual)`,
    );
    console.log(
      `     Price: ~${(this.poolReserveToken / this.poolReserveSOL).toFixed(2)} test-USDC/SOL\n`,
    );
  }

  private saveState(): void {
    const stateFile = path.join(this.poolDir, "pool-state.json");
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        poolAuthoritySecret: Array.from(this.poolAuthority!.secretKey),
        poolAuthority: this.poolAuthority!.publicKey.toBase58(),
        testMint: this.testMint!.toBase58(),
        testMintDecimals: this.testMintDecimals,
        poolReserveSOL: this.poolReserveSOL,
        poolReserveToken: this.poolReserveToken,
      }),
    );
  }

  /**
   * Constant-product AMM price calculation.
   * output = (reserveOut * amountIn) / (reserveIn + amountIn)
   */
  private calculateOutput(
    amountIn: number,
    reserveIn: number,
    reserveOut: number,
  ): number {
    const amountInWithFee = amountIn * 0.997; // 0.3% fee
    return (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);
  }

  /**
   * Determine if a trade is SOL → Token or Token → SOL.
   */
  private isSellingSOL(inputMint: string): boolean {
    return inputMint === DevnetSwapClient.SOL_MINT;
  }

  // ======= ISwapClient implementation =======

  async getQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
  }): Promise<SwapQuote> {
    if (!this.initialized) await this.loadOrSetup();

    const { inputMint, outputMint, amount, slippageBps = 50 } = params;
    const sellingSOL = this.isSellingSOL(inputMint);

    // Convert raw amount to human units
    const decimalsIn = sellingSOL ? 9 : this.testMintDecimals;
    const decimalsOut = sellingSOL ? this.testMintDecimals : 9;
    const humanAmountIn = amount / 10 ** decimalsIn;

    // Constant-product calculation
    const reserveIn = sellingSOL ? this.poolReserveSOL : this.poolReserveToken;
    const reserveOut = sellingSOL ? this.poolReserveToken : this.poolReserveSOL;
    const humanAmountOut = this.calculateOutput(
      humanAmountIn,
      reserveIn,
      reserveOut,
    );
    const rawAmountOut = Math.floor(humanAmountOut * 10 ** decimalsOut);

    const priceImpact = ((humanAmountIn / reserveIn) * 100).toFixed(4);

    return {
      inputMint,
      outputMint,
      inAmount: amount.toString(),
      outAmount: rawAmountOut.toString(),
      otherAmountThreshold: Math.floor(
        rawAmountOut * (1 - slippageBps / 10000),
      ).toString(),
      swapMode: "ExactIn",
      slippageBps,
      priceImpactPct: priceImpact,
      routePlan: [
        {
          swapInfo: {
            ammKey: this.poolAuthority?.publicKey.toBase58() || "devnet-pool",
            label: "Devnet AMM Pool",
            inputMint,
            outputMint,
            inAmount: amount.toString(),
            outAmount: rawAmountOut.toString(),
            feeAmount: Math.floor(amount * 0.003).toString(),
            feeMint: inputMint,
          },
          percent: 100,
        },
      ],
    };
  }

  async getSwapTransaction(params: {
    quoteResponse: SwapQuote;
    userPublicKey: string;
    wrapUnwrapSOL?: boolean;
  }): Promise<VersionedTransaction> {
    if (!this.initialized || !this.poolAuthority || !this.testMint) {
      throw new Error("Pool not initialized. Call setup() first.");
    }

    const conn = this.solanaConnection.getConnection();
    const userPubkey = new PublicKey(params.userPublicKey);
    const { quoteResponse } = params;
    const sellingSOL = this.isSellingSOL(quoteResponse.inputMint);

    const tx = new Transaction();

    if (sellingSOL) {
      // SOL → Token swap:
      // 1. User sends SOL to pool authority (SystemProgram.transfer)
      // 2. Pool authority sends test-USDC to user (SPL transfer — needs pool to sign)
      //
      // Since user signs the tx, we can only include the user's SOL transfer.
      // The pool authority will send tokens in a separate step (or we build a
      // partially-signed tx). For simplicity, we do both in one tx signed by both.

      const inLamports = parseInt(quoteResponse.inAmount);
      const outRaw = parseInt(quoteResponse.outAmount);

      // Ensure user has a token account for the test-USDC
      const userAta = getAssociatedTokenAddressSync(this.testMint, userPubkey);
      const userAtaInfo = await conn.getAccountInfo(userAta);
      if (!userAtaInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            userPubkey,
            userAta,
            userPubkey,
            this.testMint,
          ),
        );
      }

      // User sends SOL to pool authority
      tx.add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: this.poolAuthority.publicKey,
          lamports: inLamports,
        }),
      );

      // Pool authority sends test-USDC to user
      const poolAta = getAssociatedTokenAddressSync(
        this.testMint,
        this.poolAuthority.publicKey,
      );
      tx.add(
        createTransferInstruction(
          poolAta,
          userAta,
          this.poolAuthority.publicKey,
          BigInt(outRaw),
        ),
      );
    } else {
      // Token → SOL swap:
      // 1. User sends test-USDC to pool authority
      // 2. Pool authority sends SOL to user

      const inRaw = parseInt(quoteResponse.inAmount);
      const outLamports = parseInt(quoteResponse.outAmount);

      const userAta = getAssociatedTokenAddressSync(this.testMint, userPubkey);
      const poolAta = getAssociatedTokenAddressSync(
        this.testMint,
        this.poolAuthority.publicKey,
      );

      // User sends token to pool
      tx.add(
        createTransferInstruction(userAta, poolAta, userPubkey, BigInt(inRaw)),
      );

      // Pool sends SOL to user
      tx.add(
        SystemProgram.transfer({
          fromPubkey: this.poolAuthority.publicKey,
          toPubkey: userPubkey,
          lamports: outLamports,
        }),
      );
    }

    // Get recent blockhash
    const { blockhash } = await conn.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPubkey;

    // Pool authority must also sign (it's transferring tokens/SOL)
    tx.partialSign(this.poolAuthority);

    // Convert to VersionedTransaction for API compatibility
    const messageV0 = new TransactionMessage({
      payerKey: userPubkey,
      recentBlockhash: blockhash,
      instructions: tx.instructions,
    }).compileToV0Message();

    const vtx = new VersionedTransaction(messageV0);
    // Sign with pool authority
    vtx.sign([this.poolAuthority]);

    // Update virtual reserves
    const sellingSOLFlag = this.isSellingSOL(quoteResponse.inputMint);
    if (sellingSOLFlag) {
      const solIn = parseInt(quoteResponse.inAmount) / LAMPORTS_PER_SOL;
      const tokenOut =
        parseInt(quoteResponse.outAmount) / 10 ** this.testMintDecimals;
      this.poolReserveSOL += solIn;
      this.poolReserveToken -= tokenOut;
    } else {
      const tokenIn =
        parseInt(quoteResponse.inAmount) / 10 ** this.testMintDecimals;
      const solOut = parseInt(quoteResponse.outAmount) / LAMPORTS_PER_SOL;
      this.poolReserveToken += tokenIn;
      this.poolReserveSOL -= solOut;
    }
    this.saveState();

    return vtx;
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

  /**
   * Mint test tokens to a user wallet (for demo purposes).
   */
  async mintTestTokensTo(
    recipient: PublicKey,
    amount: number,
  ): Promise<string> {
    if (!this.initialized || !this.poolAuthority || !this.testMint) {
      throw new Error("Pool not initialized.");
    }

    const conn = this.solanaConnection.getConnection();

    const ata = await getOrCreateAssociatedTokenAccount(
      conn,
      this.poolAuthority,
      this.testMint,
      recipient,
    );

    const rawAmount = amount * 10 ** this.testMintDecimals;
    const sig = await mintTo(
      conn,
      this.poolAuthority,
      this.testMint,
      ata.address,
      this.poolAuthority,
      BigInt(rawAmount),
    );

    return typeof sig === "string" ? sig : "";
  }
}
