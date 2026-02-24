import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SolanaConnection } from "./connection.js";

/**
 * TransactionBuilder provides high-level helpers for constructing
 * common Solana transactions without requiring low-level instruction knowledge.
 */
export class TransactionBuilder {
  private connection: SolanaConnection;

  constructor(connection: SolanaConnection) {
    this.connection = connection;
  }

  /**
   * Build a SOL transfer transaction.
   */
  buildSolTransfer(
    fromPubkey: PublicKey,
    toPubkey: PublicKey,
    amountSol: number,
  ): Transaction {
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      }),
    );
    return tx;
  }

  /**
   * Build an SPL Token transfer transaction.
   * Automatically creates the recipient's Associated Token Account if needed.
   */
  async buildTokenTransfer(
    fromPubkey: PublicKey,
    toPubkey: PublicKey,
    mintPubkey: PublicKey,
    amount: number,
    decimals: number,
  ): Promise<Transaction> {
    const fromAta = getAssociatedTokenAddressSync(mintPubkey, fromPubkey);
    const toAta = getAssociatedTokenAddressSync(mintPubkey, toPubkey);

    const tx = new Transaction();

    // Check if recipient ATA exists
    const conn = this.connection.getConnection();
    const toAtaInfo = await conn.getAccountInfo(toAta);
    if (!toAtaInfo) {
      // Create ATA for recipient
      tx.add(
        createAssociatedTokenAccountInstruction(
          fromPubkey, // payer
          toAta, // ata
          toPubkey, // owner
          mintPubkey, // mint
        ),
      );
    }

    // Transfer tokens
    const rawAmount = Math.floor(amount * Math.pow(10, decimals));
    tx.add(createTransferInstruction(fromAta, toAta, fromPubkey, rawAmount));

    return tx;
  }

  /**
   * Build a compute budget instruction for priority fees.
   */
  buildComputeBudgetInstructions(
    units: number = 200_000,
    microLamports: number = 1000,
  ): TransactionInstruction[] {
    const ComputeBudget = new PublicKey(
      "ComputeBudget111111111111111111111111111111",
    );

    // SetComputeUnitLimit
    const unitsIx: TransactionInstruction = {
      keys: [],
      programId: ComputeBudget,
      data: Buffer.from([
        2,
        ...new Uint8Array(new Uint32Array([units]).buffer),
      ]),
    };

    // SetComputeUnitPrice
    const priceBuffer = Buffer.alloc(9);
    priceBuffer.writeUInt8(3, 0);
    priceBuffer.writeBigUInt64LE(BigInt(microLamports), 1);
    const priceIx: TransactionInstruction = {
      keys: [],
      programId: ComputeBudget,
      data: priceBuffer,
    };

    return [unitsIx, priceIx];
  }

  /**
   * Memo Program ID (SPL Memo v2).
   */
  static readonly MEMO_PROGRAM_ID = new PublicKey(
    "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  );

  /**
   * Build a transaction that writes an on-chain memo.
   * Memos are stored permanently in the transaction log and
   * are a simple way to interact with a Solana program.
   *
   * @param signerPubkey - The signer (who pays the tx fee)
   * @param message      - The memo text (max ~566 bytes after UTF-8 encoding)
   */
  buildMemo(signerPubkey: PublicKey, message: string): Transaction {
    const memoIx: TransactionInstruction = {
      keys: [{ pubkey: signerPubkey, isSigner: true, isWritable: false }],
      programId: TransactionBuilder.MEMO_PROGRAM_ID,
      data: Buffer.from(message, "utf-8"),
    };
    return new Transaction().add(memoIx);
  }

  /**
   * Build a SOL transfer with an attached memo.
   * Combines a System Program transfer + a Memo Program instruction
   * into a single atomic transaction.
   */
  buildSolTransferWithMemo(
    fromPubkey: PublicKey,
    toPubkey: PublicKey,
    amountSol: number,
    memo: string,
  ): Transaction {
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
    const tx = new Transaction();

    tx.add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      }),
    );

    tx.add({
      keys: [{ pubkey: fromPubkey, isSigner: true, isWritable: false }],
      programId: TransactionBuilder.MEMO_PROGRAM_ID,
      data: Buffer.from(memo, "utf-8"),
    });

    return tx;
  }
