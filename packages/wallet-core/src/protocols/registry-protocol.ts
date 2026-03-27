/**
 * protocols/registry-protocol.ts
 *
 * Decentralised agent registry built on top of the Solana SPL Memo Program.
 *
 * How it works:
 * - A single "registry wallet" public key acts as a coordination anchor — a
 *   Solana address that merchants reference when registering. It never needs
 *   to hold funds; it is purely an on-chain hashtag.
 * - To register, a merchant sends a zero-value SOL self-transfer with an SPL
 *   Memo containing `{"agent":"<name>","manifest":"<url>","v":1}`. The
 *   registry wallet is added as a non-signer key so that the transaction shows
 *   up when querying `getSignaturesForAddress` on the registry wallet.
 * - To discover merchants, a buyer agent fetches all transactions involving
 *   the registry wallet, parses the memos, and verifies each manifest URL is
 *   still live.
 *
 * This means the blockchain **is** the registry. No database. No central
 * server. No single point of failure. Any buyer agent anywhere can
 * reconstruct the full registry with a single RPC call.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  type ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { TransactionBuilder } from "./transaction-builder.js";

// ── Registry wallet address ─────────────────────────────────────────────────
// Override via REGISTRY_WALLET_ADDRESS env var, or use this default.
// This address acts as a coordination point — not a funded wallet.
const DEFAULT_REGISTRY_ADDRESS = "regXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

export function getRegistryAddress(): PublicKey {
  const addr = process.env.REGISTRY_WALLET_ADDRESS || DEFAULT_REGISTRY_ADDRESS;
  return new PublicKey(addr);
}

// ── Types ────────────────────────────────────────────────────────────────────

/** Shape of the JSON stored in the SPL Memo for agent registration. */
export interface AgentMemo {
  agent: string;
  manifest: string;
  v: number;
}

/** A live merchant discovered from the on-chain registry. */
export interface DiscoveredAgent {
  /** Agent name from the memo */
  name: string;
  /** Manifest URL from the memo */
  manifest_url: string;
  /** Wallet address that registered (the transaction signer) */
  registered_by: string;
  /** When the on-chain registration happened (block time) */
  registered_at: string;
  /** Transaction signature of the registration memo */
  registration_tx: string;
  /** Services listed in the live manifest (fetched at discovery time) */
  services: any[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Attempt to parse a string as a valid agent registration memo.
 */
function parseAgentMemo(raw: string): AgentMemo | null {
  try {
    const obj = JSON.parse(raw);
    if (
      typeof obj.agent === "string" &&
      typeof obj.manifest === "string" &&
      typeof obj.v === "number"
    ) {
      return obj as AgentMemo;
    }
  } catch {
    // not valid JSON — ignore
  }
  return null;
}

/**
 * Extract the memo text from a parsed Solana transaction.
 * Looks for an instruction whose programId is the SPL Memo Program.
 */
async function extractMemo(
  tx: ParsedTransactionWithMeta | null,
): Promise<string | null> {
  if (!tx?.transaction?.message?.instructions) return null;
  const MEMO_ID = TransactionBuilder.MEMO_PROGRAM_ID.toBase58();

  for (const ix of tx.transaction.message.instructions) {
    // Parsed instructions have a `program` field; partially-parsed have `programId`
    if ("programId" in ix && ix.programId.toBase58() === MEMO_ID) {
      // The memo data is stored as the instruction data (raw string)
      if ("parsed" in ix) return String(ix.parsed);
      if ("data" in ix) {
        // base58-encoded data — decode
        const bs58 = await import("bs58");
        return Buffer.from(bs58.default.decode(ix.data as string)).toString(
          "utf-8",
        );
      }
    }
  }
  return null;
}

// ── Registration ─────────────────────────────────────────────────────────────

/**
 * Build a Solana transaction that registers an agent on-chain via SPL Memo.
 *
 * The transaction:
 * 1. Transfers 0 SOL from the signer to themselves (no-op transfer keeps fees tiny)
 * 2. Writes a Memo instruction containing the JSON registration data
 * 3. Includes the registry wallet as a non-signer account key so that
 *    `getSignaturesForAddress(registryWallet)` will pick up this transaction.
 */
export function buildRegistrationTx(
  signerPubkey: PublicKey,
  agentName: string,
  manifestUrl: string,
): Transaction {
  const registryAddress = getRegistryAddress();

  const memo: AgentMemo = {
    agent: agentName,
    manifest: manifestUrl,
    v: 1,
  };
  const memoStr = JSON.stringify(memo);

  const tx = new Transaction();

  // Zero-value transfer to self to keep fee low
  tx.add(
    SystemProgram.transfer({
      fromPubkey: signerPubkey,
      toPubkey: signerPubkey,
      lamports: 0,
    }),
  );

  // Memo instruction — include registry wallet as a non-signer key so its
  // transaction history includes this registration.
  tx.add({
    keys: [
      { pubkey: signerPubkey, isSigner: true, isWritable: false },
      { pubkey: registryAddress, isSigner: false, isWritable: false },
    ],
    programId: TransactionBuilder.MEMO_PROGRAM_ID,
    data: Buffer.from(memoStr, "utf-8"),
  });

  return tx;
}

// ── Discovery ────────────────────────────────────────────────────────────────

/**
 * Discover all registered agents by scanning the on-chain memo history
 * of the registry wallet address.
 *
 * Steps:
 * 1. Fetch recent transaction signatures involving the registry wallet.
 * 2. Fetch + parse each transaction to extract SPL Memo data.
 * 3. Validate memo JSON as an agent registration.
 * 4. Verify manifest URL is still live by fetching it.
 * 5. Return only live, verified merchants.
 *
 * @param connection  A Solana Connection (or SolanaConnection wrapper)
 * @param limit       Max number of signatures to scan (default 100)
 */
export async function discoverRegistry(
  connection: Connection,
  limit: number = 100,
): Promise<DiscoveredAgent[]> {
  const registryAddress = getRegistryAddress();

  // Step 1: Get transaction signatures for the registry wallet
  const signatures = await connection.getSignaturesForAddress(registryAddress, {
    limit,
  });

  const agents: DiscoveredAgent[] = [];
  const seenManifests = new Set<string>();

  // Step 2-4: Process each transaction
  for (const sigInfo of signatures) {
    try {
      const tx = await connection.getParsedTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });

      const memoText = await extractMemo(tx);
      if (!memoText) continue;

      const memo = parseAgentMemo(memoText);
      if (!memo) continue;

      // Deduplicate — keep only the latest registration per manifest URL
      if (seenManifests.has(memo.manifest)) continue;
      seenManifests.add(memo.manifest);

      // Step 3-4: Verify manifest is still live
      try {
        const resp = await fetch(memo.manifest, {
          signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok) continue;

        const manifest = (await resp.json()) as any;
        if (!manifest?.services || !Array.isArray(manifest.services)) continue;
        if (manifest.services.length === 0) continue;

        // Determine who signed the registration
        const signer =
          tx?.transaction?.message?.accountKeys?.[0]?.pubkey?.toBase58() ??
          "unknown";

        agents.push({
          name: memo.agent,
          manifest_url: memo.manifest,
          registered_by: signer,
          registered_at: sigInfo.blockTime
            ? new Date(sigInfo.blockTime * 1000).toISOString()
            : "unknown",
          registration_tx: sigInfo.signature,
          services: manifest.services,
        });
      } catch {
        // Manifest unreachable — skip (merchant offline)
      }
    } catch {
      // Transaction parse failed — skip
    }
  }

  return agents;
}
