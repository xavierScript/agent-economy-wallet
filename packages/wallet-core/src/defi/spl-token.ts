import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMint,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SolanaConnection } from "../connection.js";

export interface TokenAccountInfo {
  mint: string;
  owner: string;
  amount: bigint;
  decimals: number;
  uiAmount: number;
  address: string;
}

/**
 * SplTokenService handles SPL Token operations:
 * - Create token accounts
 * - Transfer tokens
 * - Query balances and metadata
 * - Mint test tokens (devnet only)
 */
export class SplTokenService {
  private connection: SolanaConnection;

  constructor(connection: SolanaConnection) {
    this.connection = connection;
  }

  /**
   * Get the Associated Token Account (ATA) address for a wallet + mint.
   */
  getTokenAccountAddress(owner: PublicKey, mint: PublicKey): PublicKey {
    return getAssociatedTokenAddressSync(mint, owner);
  }

  /**
   * Get token account info, or null if it doesn't exist.
   */
  async getTokenAccount(
    owner: PublicKey,
    mint: PublicKey,
  ): Promise<TokenAccountInfo | null> {
    try {
      const ata = getAssociatedTokenAddressSync(mint, owner);
      const account = await getAccount(this.connection.getConnection(), ata);
      const mintInfo = await getMint(this.connection.getConnection(), mint);

      return {
        mint: mint.toBase58(),
        owner: owner.toBase58(),
        amount: account.amount,
        decimals: mintInfo.decimals,
        uiAmount: Number(account.amount) / Math.pow(10, mintInfo.decimals),
        address: ata.toBase58(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get all SPL token accounts for a wallet.
   */
  async getAllTokenAccounts(owner: PublicKey): Promise<TokenAccountInfo[]> {
    const conn = this.connection.getConnection();
    const accounts = await conn.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    });

    return accounts.value.map((acc) => {
      const parsed = acc.account.data.parsed.info;
      return {
        mint: parsed.mint,
        owner: parsed.owner,
        amount: BigInt(parsed.tokenAmount.amount),
        decimals: parsed.tokenAmount.decimals,
        uiAmount: parsed.tokenAmount.uiAmount || 0,
        address: acc.pubkey.toBase58(),
      };
    });
  }

  /**
   * Build a transaction to create an ATA if it doesn't exist.
   */
  async buildCreateTokenAccount(
    payer: PublicKey,
    owner: PublicKey,
    mint: PublicKey,
  ): Promise<Transaction | null> {
    const ata = getAssociatedTokenAddressSync(mint, owner);
    const conn = this.connection.getConnection();
    const info = await conn.getAccountInfo(ata);

    if (info) return null; // Already exists

    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(payer, ata, owner, mint),
    );
    return tx;
  }

  /**
   * Get mint info (decimals, supply, authority).
   */
  async getMintInfo(mint: PublicKey): Promise<{
    decimals: number;
    supply: bigint;
    mintAuthority: string | null;
  }> {
    const mintInfo = await getMint(this.connection.getConnection(), mint);
    return {
      decimals: mintInfo.decimals,
      supply: mintInfo.supply,
      mintAuthority: mintInfo.mintAuthority?.toBase58() || null,
    };
  }
}
