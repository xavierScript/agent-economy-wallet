/**
 * streaming-payment-service.ts
 *
 * Per-compute streaming payments via MagicBlock Ephemeral Rollups.
 *
 * A buyer agent opens a streaming session. A `StreamSession` PDA is
 * created on Solana L1 and delegated to the MagicBlock ER. Every tick
 * (≥500ms) a USDC transfer fires on L1 and the session state is updated
 * on the ER in real time. When the agent closes the session, the PDA is
 * undelegated and final state commits back to L1.
 *
 * This service builds Anchor instructions manually (same pattern as
 * reputation-client.ts) to avoid heavy Anchor TS client dependencies.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import type { KeyManager } from "../core/key-manager.js";
import type { WalletService } from "../core/wallet-service.js";
import type { PolicyEngine } from "../guardrails/policy-engine.js";
import type { AuditLogger } from "../core/audit-logger.js";
import type { SolanaConnection } from "../core/connection.js";
import type { TransactionBuilder } from "./transaction-builder.js";
import { getReputationProgramId } from "./reputation-client.js";

// ── Types ────────────────────────────────────────────────────────────────

export interface StreamSession {
  sessionId: string;
  sessionIdBytes: Uint8Array;
  walletId: string;
  buyerPublicKey: string;
  merchantAddress: string;
  pdaAddress: string;
  ratePerTick: number;
  intervalMs: number;
  mint: string;
  startedAt: Date;
  totalPaid: number;
  tickCount: number;
  status: "active" | "closing" | "closed";
  erEndpoint: string;
  intervalHandle?: ReturnType<typeof setInterval>;
  safetyHandle?: ReturnType<typeof setTimeout>;
}

export interface StreamSessionResult {
  sessionId: string;
  totalPaid: number;
  tickCount: number;
  durationMs: number;
  settlementSignature: string;
  solscanUrl: string;
}

// ── Instruction discriminators ──────────────────────────────────────────
// Anchor instruction discriminators = SHA256("global:<instruction_name>")[0..8]

function anchorDiscriminator(name: string): Buffer {
  const hash = createHash("sha256").update(`global:${name}`).digest();
  return Buffer.from(hash.subarray(0, 8));
}

const IX_INITIALIZE_SESSION = anchorDiscriminator("initialize_session");
const IX_RECORD_TICK = anchorDiscriminator("record_tick");
const IX_CLOSE_SESSION = anchorDiscriminator("close_session");
const IX_DELEGATE_SESSION = anchorDiscriminator("delegate_session");

// ── Constants ───────────────────────────────────────────────────────────

const STREAM_SESSION_SEED = Buffer.from("stream_session");
const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

// MagicBlock delegation program
const DELEGATION_PROGRAM_ID = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh",
);

// ── Helpers ─────────────────────────────────────────────────────────────

/** Convert a UUID string to a 16-byte Uint8Array. */
function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Derive the StreamSession PDA address. */
function deriveSessionPda(
  programId: PublicKey,
  buyerPubkey: PublicKey,
  sessionIdBytes: Uint8Array,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [STREAM_SESSION_SEED, buyerPubkey.toBuffer(), Buffer.from(sessionIdBytes)],
    programId,
  );
}

// ── Service ─────────────────────────────────────────────────────────────

export class StreamingPaymentService {
  private sessions: Map<string, StreamSession> = new Map();
  private programId: PublicKey;
  private erConnection: Connection;
  private l1Connection: Connection;
  private erEndpoint: string;
  private erValidator: PublicKey;

  constructor(
    private walletService: WalletService,
    private keyManager: KeyManager,
    private txBuilder: TransactionBuilder,
    private policy: PolicyEngine,
    private audit: AuditLogger,
    private l1Conn: SolanaConnection,
  ) {
    // Same program as reputation — streaming instructions live in the same
    // onchain program (A1N2w7TTbQXRcmV3xqq5dqsG6cja1mNmjkKKnKAXxDLz)
    this.programId = getReputationProgramId();

    this.erEndpoint =
      process.env.MAGICBLOCK_ER_ENDPOINT || "https://devnet.magicblock.app";
    this.erConnection = new Connection(this.erEndpoint, "confirmed");
    this.l1Connection = this.l1Conn.getConnection();

    const validatorStr =
      process.env.MAGICBLOCK_ER_VALIDATOR ||
      "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57";
    this.erValidator = new PublicKey(validatorStr);
  }

  // ── Public API ──────────────────────────────────────────────────────

  async openSession(params: {
    walletId: string;
    merchantAddress: string;
    ratePerTick: number;
    intervalMs: number;
    mint?: string;
    maxDurationMs?: number;
  }): Promise<StreamSession> {
    // 1. Validate
    if (params.intervalMs < 500) {
      throw new Error("intervalMs must be at least 500");
    }
    if (params.ratePerTick <= 0) {
      throw new Error("ratePerTick must be greater than 0");
    }

    // 2. Policy check
    const violation = this.policy.checkLimits(
      params.walletId,
      params.ratePerTick,
    );
    if (violation) {
      throw new Error(`Policy violation: ${violation}`);
    }

    // 3. Keys
    const buyerPubkeyStr = this.walletService.getPublicKey(params.walletId);
    const buyerPubkey = new PublicKey(buyerPubkeyStr);
    const merchantPubkey = new PublicKey(params.merchantAddress);

    // 4. Session ID
    const sessionId = uuidv4();
    const sessionIdBytes = uuidToBytes(sessionId);

    // 5. Derive PDA
    const [pdaAddress] = deriveSessionPda(
      this.programId,
      buyerPubkey,
      sessionIdBytes,
    );

    // 6. Init and Delegate session on L1
    const initIx = this.buildInitializeSessionIx(
      buyerPubkey,
      merchantPubkey,
      pdaAddress,
      sessionIdBytes,
      params.ratePerTick,
      params.intervalMs,
    );
    
    const delegateIx = this.buildDelegateSessionIx(
      buyerPubkey,
      pdaAddress,
      sessionIdBytes,
    );

    const initAndDelegateTx = new Transaction().add(initIx, delegateIx);
    
    await this.walletService.signAndSendTransaction(
      params.walletId,
      initAndDelegateTx,
      {
        action: "stream:initialize_and_delegate_session",
        details: {
          sessionId,
          merchant: params.merchantAddress,
          ratePerTick: params.ratePerTick,
          intervalMs: params.intervalMs,
          erEndpoint: this.erEndpoint,
        },
      },
    );

    // 8. Create session object
    const mint = params.mint || DEVNET_USDC_MINT;
    const maxDurationMs = params.maxDurationMs || 60_000;

    const session: StreamSession = {
      sessionId,
      sessionIdBytes,
      walletId: params.walletId,
      buyerPublicKey: buyerPubkeyStr,
      merchantAddress: params.merchantAddress,
      pdaAddress: pdaAddress.toBase58(),
      ratePerTick: params.ratePerTick,
      intervalMs: params.intervalMs,
      mint,
      startedAt: new Date(),
      totalPaid: 0,
      tickCount: 0,
      status: "active",
      erEndpoint: this.erEndpoint,
    };

    this.sessions.set(sessionId, session);

    // 9. Start tick interval
    session.intervalHandle = setInterval(() => {
      this._tick(sessionId).catch((err) => {
        console.error(`Tick error for session ${sessionId}:`, err.message);
      });
    }, params.intervalMs);

    // 10. Safety timeout
    session.safetyHandle = setTimeout(() => {
      this.closeSession(sessionId).catch((err) => {
        console.error(
          `Safety close error for session ${sessionId}:`,
          err.message,
        );
      });
    }, maxDurationMs);

    // 11. Audit log
    this.audit.log({
      action: "stream_session_open",
      walletId: params.walletId,
      publicKey: buyerPubkeyStr,
      success: true,
      details: {
        sessionId,
        merchant: params.merchantAddress,
        ratePerTick: params.ratePerTick,
        intervalMs: params.intervalMs,
        pdaAddress: pdaAddress.toBase58(),
        erEndpoint: this.erEndpoint,
        maxDurationMs,
      },
    });

    return session;
  }

  async closeSession(sessionId: string): Promise<StreamSessionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`No session found with ID: ${sessionId}`);
    }
    if (session.status === "closed") {
      throw new Error(`Session ${sessionId} is already closed`);
    }

    // 1. Mark closing
    session.status = "closing";

    // 2. Clear intervals
    if (session.intervalHandle) clearInterval(session.intervalHandle);
    if (session.safetyHandle) clearTimeout(session.safetyHandle);

    // 3. Close session on ER
    const buyerPubkey = new PublicKey(session.buyerPublicKey);
    const pdaPubkey = new PublicKey(session.pdaAddress);

    const closeIx = this.buildCloseSessionIx(
      buyerPubkey,
      pdaPubkey,
      session.sessionIdBytes,
    );

    // Sign and send on the ER connection
    const closeTx = new Transaction().add(closeIx);
    const keypair = this.keyManager.unlockWallet(session.walletId);

    const { blockhash } = await this.erConnection.getLatestBlockhash();
    closeTx.recentBlockhash = blockhash;
    closeTx.feePayer = keypair.publicKey;
    closeTx.sign(keypair);

    const settlementSignature = await this.erConnection.sendRawTransaction(
      closeTx.serialize(),
      { skipPreflight: true },
    );

    // 4. Wait for L1 confirmation (poll for undelegation, up to 30s)
    const startPoll = Date.now();
    while (Date.now() - startPoll < 30_000) {
      try {
        const accountInfo =
          await this.l1Connection.getAccountInfo(pdaPubkey);
        if (accountInfo && accountInfo.owner.equals(this.programId)) {
          break; // undelegated back to our program
        }
      } catch {
        // ignore polling errors
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 5. Finalize
    const durationMs = Date.now() - session.startedAt.getTime();
    session.status = "closed";

    // 6. Perform the final L1 settlement transfer
    let l1TransferSignature = settlementSignature;
    if (session.totalPaid > 0) {
      const merchantPubkey = new PublicKey(session.merchantAddress);
      const mintPubkey = new PublicKey(session.mint);

      const transferTx = await this.txBuilder.buildTokenTransfer(
        buyerPubkey,
        merchantPubkey,
        mintPubkey,
        session.totalPaid / 1_000_000, // convert base units to human-readable (6 decimals)
        6, // USDC decimals
      );

      const txResult = await this.walletService.signAndSendTransaction(
        session.walletId,
        transferTx,
        {
          action: "stream:final_settlement",
          details: {
            sessionId,
            totalPaid: session.totalPaid,
          },
        },
      );
      l1TransferSignature = txResult.signature;
    }

    this.audit.log({
      action: "stream_session_close",
      walletId: session.walletId,
      publicKey: session.buyerPublicKey,
      txSignature: l1TransferSignature,
      success: true,
      details: {
        sessionId,
        totalPaid: session.totalPaid,
        tickCount: session.tickCount,
        durationMs,
      },
    });

    const result: StreamSessionResult = {
      sessionId,
      totalPaid: session.totalPaid,
      tickCount: session.tickCount,
      durationMs,
      settlementSignature: l1TransferSignature,
      solscanUrl: `https://solscan.io/tx/${l1TransferSignature}?cluster=devnet`,
    };

    this.sessions.delete(sessionId);
    return result;
  }

  getSession(sessionId: string): StreamSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  listActiveSessions(): StreamSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === "active",
    );
  }

  // ── Private: Tick ───────────────────────────────────────────────────

  private async _tick(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "active") {
      return;
    }

    const buyerPubkey = new PublicKey(session.buyerPublicKey);
    const merchantPubkey = new PublicKey(session.merchantAddress);
    const mintPubkey = new PublicKey(session.mint);

    try {
      // 1. Update local state
      session.totalPaid += session.ratePerTick;
      session.tickCount += 1;

      // 3. Record tick on ER
      const pdaPubkey = new PublicKey(session.pdaAddress);
      const recordIx = this.buildRecordTickIx(
        buyerPubkey,
        pdaPubkey,
        session.sessionIdBytes,
        session.ratePerTick,
      );
      const recordTx = new Transaction().add(recordIx);
      const keypair = this.keyManager.unlockWallet(session.walletId);

      const { blockhash } = await this.erConnection.getLatestBlockhash();
      recordTx.recentBlockhash = blockhash;
      recordTx.feePayer = keypair.publicKey;
      recordTx.sign(keypair);

      await this.erConnection.sendRawTransaction(recordTx.serialize(), {
        skipPreflight: true,
      });

      // 4. Audit
      this.audit.log({
        action: "stream_tick",
        walletId: session.walletId,
        publicKey: session.buyerPublicKey,
        success: true,
        details: {
          sessionId,
          tickCount: session.tickCount,
          totalPaid: session.totalPaid,
        },
      });
    } catch (err: any) {
      this.audit.log({
        action: "stream_tick_error",
        walletId: session.walletId,
        publicKey: session.buyerPublicKey,
        success: false,
        error: err.message,
        details: { sessionId, tickCount: session.tickCount },
      });

      // Auto-close on payment failure
      try {
        await this.closeSession(sessionId);
      } catch {
        // swallow — we already logged the error
      }
    }
  }

  // ── Private: Instruction builders ─────────────────────────────────

  private buildInitializeSessionIx(
    buyer: PublicKey,
    merchant: PublicKey,
    pda: PublicKey,
    sessionIdBytes: Uint8Array,
    ratePerTick: number,
    intervalMs: number,
  ): TransactionInstruction {
    // Data: discriminator(8) + session_id(16) + rate_per_tick(8) + interval_ms(8)
    const data = Buffer.alloc(8 + 16 + 8 + 8);
    IX_INITIALIZE_SESSION.copy(data, 0);
    Buffer.from(sessionIdBytes).copy(data, 8);
    data.writeBigUInt64LE(BigInt(ratePerTick), 24);
    data.writeBigUInt64LE(BigInt(intervalMs), 32);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: merchant, isSigner: false, isWritable: false },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data,
    });
  }

  private buildDelegateSessionIx(
    buyer: PublicKey,
    sessionPda: PublicKey,
    sessionIdBytes: Uint8Array,
  ): TransactionInstruction {
    // Data: discriminator(8) + session_id(16)
    const data = Buffer.alloc(8 + 16);
    IX_DELEGATE_SESSION.copy(data, 0);
    Buffer.from(sessionIdBytes).copy(data, 8);

    // The #[delegate] macro expands DelegateSession to this account order:
    //   1. payer (Signer, mut)
    //   2. validator (Option<AccountInfo>) — present with ER validator
    //   3. buffer_session — PDA of OUR program: seeds = ["buffer", session.key()]
    //   4. delegation_record_session — PDA of delegation program: seeds = ["delegation", session.key()]
    //   5. delegation_metadata_session — PDA of delegation program: seeds = ["delegation-metadata", session.key()]
    //   6. session — the PDA being delegated (mut)
    //   7. owner_program — our program ID
    //   8. delegation_program — DELeGG...
    //   9. system_program

    // Derive buffer PDA (owned by OUR program)
    const [bufferSession] = PublicKey.findProgramAddressSync(
      [Buffer.from("buffer"), sessionPda.toBuffer()],
      this.programId,
    );

    // Derive the delegation record PDA (owned by delegation program)
    const [delegationRecord] = PublicKey.findProgramAddressSync(
      [Buffer.from("delegation"), sessionPda.toBuffer()],
      DELEGATION_PROGRAM_ID,
    );

    // Derive the delegation metadata PDA (owned by delegation program)
    const [delegationMetadata] = PublicKey.findProgramAddressSync(
      [Buffer.from("delegation-metadata"), sessionPda.toBuffer()],
      DELEGATION_PROGRAM_ID,
    );

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        // 1. payer
        { pubkey: buyer, isSigner: true, isWritable: true },
        // 2. validator (Option — present)
        { pubkey: this.erValidator, isSigner: false, isWritable: false },
        // 3. buffer_session
        { pubkey: bufferSession, isSigner: false, isWritable: true },
        // 4. delegation_record_session
        { pubkey: delegationRecord, isSigner: false, isWritable: true },
        // 5. delegation_metadata_session
        { pubkey: delegationMetadata, isSigner: false, isWritable: true },
        // 6. session (the PDA to delegate)
        { pubkey: sessionPda, isSigner: false, isWritable: true },
        // 7. owner_program
        {
          pubkey: this.programId,
          isSigner: false,
          isWritable: false,
        },
        // 8. delegation_program
        {
          pubkey: DELEGATION_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        },
        // 9. system_program
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data,
    });
  }

  private buildRecordTickIx(
    buyer: PublicKey,
    sessionPda: PublicKey,
    _sessionIdBytes: Uint8Array,
    amountPaid: number,
  ): TransactionInstruction {
    // Data: discriminator(8) + amount_paid(8)
    const data = Buffer.alloc(8 + 8);
    IX_RECORD_TICK.copy(data, 0);
    data.writeBigUInt64LE(BigInt(amountPaid), 8);

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: sessionPda, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: false },
      ],
      data,
    });
  }

  private buildCloseSessionIx(
    buyer: PublicKey,
    sessionPda: PublicKey,
    _sessionIdBytes: Uint8Array,
  ): TransactionInstruction {
    // Data: just the discriminator
    const data = Buffer.from(IX_CLOSE_SESSION);

    // The #[commit] macro injects magic_context and magic_program accounts.
    // magic_context = PDA of the MagicBlock delegation program
    // magic_program = the delegation program itself

    const [magicContext] = PublicKey.findProgramAddressSync(
      [Buffer.from("magic")],
      DELEGATION_PROGRAM_ID,
    );

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: sessionPda, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: magicContext, isSigner: false, isWritable: true },
        {
          pubkey: DELEGATION_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        },
      ],
      data,
    });
  }
}
