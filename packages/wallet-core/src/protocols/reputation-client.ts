/**
 * reputation-client.ts
 *
 * TypeScript client for reading on-chain merchant reputation data.
 *
 * This module provides a lightweight read-only interface to the
 * agent-reputation Anchor program. It directly deserializes the PDA
 * account data using the known layout, making it safe to use in
 * Next.js (Explorer) and in the MCP server without pulling in heavy
 * Anchor/Rust deps.
 */

import { Connection, PublicKey } from "@solana/web3.js";

// ── Program ID ──────────────────────────────────────────────────────────
// The default devnet program ID. Consumers should pass the programId from their config.
const DEFAULT_REPUTATION_PROGRAM_ID = "A1N2w7TTbQXRcmV3xqq5dqsG6cja1mNmjkKKnKAXxDLz";

export function getReputationProgramId(): PublicKey {
  return new PublicKey(DEFAULT_REPUTATION_PROGRAM_ID);
}

// ── Types ────────────────────────────────────────────────────────────────

export interface MerchantReputation {
  /** Merchant public key */
  merchant: string;
  /** Total payments received */
  totalPayments: number;
  /** Total volume in smallest token units (lamports / base units) */
  totalVolumeLamports: number;
  /** Total volume in human-readable units (USDC with 6 decimals) */
  totalVolumeDisplay: number;
  /** Approximate unique buyers */
  uniqueBuyers: number;
  /** Unix timestamp of last payment */
  lastPaymentTs: number;
  /** Trust score: 0-100, derived from payment count */
  trustScore: number;
  /** Whether the reputation account exists on-chain */
  exists: boolean;
}

// ── PDA Derivation ──────────────────────────────────────────────────────

/**
 * Derive the PDA address for a merchant's reputation account.
 */
export function deriveMerchantPda(
  merchantPubkey: PublicKey,
  programId?: PublicKey,
): [PublicKey, number] {
  const pid = programId ?? getReputationProgramId();
  return PublicKey.findProgramAddressSync(
    [Buffer.from("merchant"), merchantPubkey.toBuffer()],
    pid,
  );
}

// ── Account Deserialization ─────────────────────────────────────────────

/**
 * Account data layout (after 8-byte Anchor discriminator):
 *   merchant:              Pubkey (32 bytes)
 *   total_payments:        u64   (8 bytes)
 *   total_volume_lamports: u64   (8 bytes)
 *   unique_buyers:         u32   (4 bytes)
 *   last_payment_ts:       i64   (8 bytes)
 *   bump:                  u8    (1 byte)
 *   Total: 8 + 32 + 8 + 8 + 4 + 8 + 1 = 69 bytes
 */
const ACCOUNT_DATA_SIZE = 8 + 32 + 8 + 8 + 4 + 8 + 1;

function deserializeMerchantAccount(
  data: Buffer,
): Omit<MerchantReputation, "exists"> | null {
  if (data.length < ACCOUNT_DATA_SIZE) return null;

  let offset = 8; // skip Anchor discriminator

  const merchantBytes = data.subarray(offset, offset + 32);
  const merchant = new PublicKey(merchantBytes).toBase58();
  offset += 32;

  const totalPayments = Number(data.readBigUInt64LE(offset));
  offset += 8;

  const totalVolumeLamports = Number(data.readBigUInt64LE(offset));
  offset += 8;

  const uniqueBuyers = data.readUInt32LE(offset);
  offset += 4;

  const lastPaymentTs = Number(data.readBigInt64LE(offset));

  // Trust score: asymptotic → (payments / (payments + 10)) * 100
  // 1 payment = 9, 10 = 50, 50 = 83, 100 = 91, 500 = 98
  const trustScore = Math.round(
    (totalPayments / (totalPayments + 10)) * 100,
  );

  const totalVolumeDisplay = totalVolumeLamports / 1_000_000;

  return {
    merchant,
    totalPayments,
    totalVolumeLamports,
    totalVolumeDisplay,
    uniqueBuyers,
    lastPaymentTs,
    trustScore,
  };
}

// ── Public API ──────────────────────────────────────────────────────────

const EMPTY_REPUTATION = (merchantAddress: string): MerchantReputation => ({
  merchant: merchantAddress,
  totalPayments: 0,
  totalVolumeLamports: 0,
  totalVolumeDisplay: 0,
  uniqueBuyers: 0,
  lastPaymentTs: 0,
  trustScore: 0,
  exists: false,
});

/**
 * Fetch a merchant's on-chain reputation data.
 * Returns a MerchantReputation object with `exists: false` if the
 * account has not been initialized yet.
 */
export async function fetchMerchantReputation(
  connection: Connection,
  merchantAddress: string,
  programId?: PublicKey,
): Promise<MerchantReputation> {
  const merchantPubkey = new PublicKey(merchantAddress);
  const [pda] = deriveMerchantPda(merchantPubkey, programId);

  try {
    const accountInfo = await connection.getAccountInfo(pda);

    if (!accountInfo || !accountInfo.data) {
      return EMPTY_REPUTATION(merchantAddress);
    }

    const parsed = deserializeMerchantAccount(Buffer.from(accountInfo.data));

    if (!parsed) {
      return EMPTY_REPUTATION(merchantAddress);
    }

    return { ...parsed, exists: true };
  } catch {
    return EMPTY_REPUTATION(merchantAddress);
  }
}

// ── Instructions ─────────────────────────────────────────────────────────

/**
 * Creates the `record_payment` instruction to bump the merchant's on-chain metrics.
 *
 * Discriminator: [226, 154, 10, 27, 9, 14, 148, 137]
 * Accounts:
 * 1. merchant_account (PDA) - writable
 * 2. merchant (Wallet) - read-only
 * 3. buyer (Wallet) - signer
 */
export function createRecordPaymentInstruction(
  merchantPubkey: PublicKey,
  buyerPubkey: PublicKey,
  amount: bigint | number,
  programId?: PublicKey,
): import("@solana/web3.js").TransactionInstruction {
  const { TransactionInstruction } = require("@solana/web3.js");
  const pid = programId ?? getReputationProgramId();
  const [pda] = deriveMerchantPda(merchantPubkey, pid);

  const data = Buffer.alloc(8 + 8);
  // record_payment discriminator
  data.set([226, 154, 10, 27, 9, 14, 148, 137], 0);
  data.writeBigUInt64LE(BigInt(amount), 8);

  return new TransactionInstruction({
    programId: pid,
    keys: [
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: merchantPubkey, isSigner: false, isWritable: false },
      { pubkey: buyerPubkey, isSigner: true, isWritable: false },
    ],
    data,
  });
}

