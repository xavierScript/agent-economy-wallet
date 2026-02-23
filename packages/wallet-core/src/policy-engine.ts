import { Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

/**
 * A policy rule defines constraints on transactions.
 */
export interface PolicyRule {
  /** Rule identifier */
  name: string;
  /** Maximum lamports per transaction (undefined = unlimited) */
  maxLamportsPerTx?: number;
  /** Maximum transactions per hour */
  maxTxPerHour?: number;
  /** Maximum transactions per day */
  maxTxPerDay?: number;
  /** Cooldown between transactions in milliseconds */
  cooldownMs?: number;
  /** Allowed program IDs (whitelist). If empty, all programs allowed. */
  allowedPrograms?: string[];
  /** Blocked program IDs (blacklist) */
  blockedPrograms?: string[];
  /** Maximum total daily spend in lamports */
  maxDailySpendLamports?: number;
}

/**
 * A policy applied to a specific wallet.
 */
export interface Policy {
  /** Policy identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Policy rules */
  rules: PolicyRule[];
  /** Creation timestamp */
  createdAt: string;
}

interface TxRecord {
  timestamp: number;
  lamports: number;
}

/**
 * PolicyEngine enforces transaction limits, rate limiting, and program allowlists
 * for each wallet. Policies are the first line of defense against misuse.
 *
 * Architecture:
 * - Each wallet can have one policy attached
 * - Policies are checked BEFORE any transaction is signed
 * - Rate limits are tracked in-memory with window-based counting
 * - All violations are logged via AuditLogger
 */
export class PolicyEngine {
  private policies: Map<string, Policy> = new Map();
  private txHistory: Map<string, TxRecord[]> = new Map();

  /**
   * Attach a policy to a wallet.
   */
  attachPolicy(walletId: string, policy: Policy): void {
    this.policies.set(walletId, policy);
  }

  /**
   * Get the policy for a wallet.
   */
  getPolicy(walletId: string): Policy | undefined {
    return this.policies.get(walletId);
  }

  /**
   * Remove a wallet's policy.
   */
  removePolicy(walletId: string): void {
    this.policies.delete(walletId);
  }

  /**
   * Check a transaction against a wallet's policy.
   * Returns null if allowed, or a string describing the violation.
   */
  checkTransaction(
    walletId: string,
    transaction: Transaction,
    context: { action: string; details?: Record<string, unknown> },
  ): string | null {
    const policy = this.policies.get(walletId);
    if (!policy) return null; // No policy = allow (but warned in logs)

    for (const rule of policy.rules) {
      // Check transfer amount
      if (rule.maxLamportsPerTx !== undefined) {
        const totalLamports = this.estimateTransferAmount(transaction);
        if (totalLamports > rule.maxLamportsPerTx) {
          return `Transaction value ${totalLamports} lamports exceeds max ${rule.maxLamportsPerTx} lamports (${rule.name})`;
        }
      }

      // Check rate limits
      const history = this.txHistory.get(walletId) || [];
      const now = Date.now();

      if (rule.maxTxPerHour !== undefined) {
        const hourAgo = now - 60 * 60 * 1000;
        const txInHour = history.filter((h) => h.timestamp > hourAgo).length;
        if (txInHour >= rule.maxTxPerHour) {
          return `Rate limit exceeded: ${txInHour}/${rule.maxTxPerHour} transactions per hour (${rule.name})`;
        }
      }

      if (rule.maxTxPerDay !== undefined) {
        const dayAgo = now - 24 * 60 * 60 * 1000;
        const txInDay = history.filter((h) => h.timestamp > dayAgo).length;
        if (txInDay >= rule.maxTxPerDay) {
          return `Rate limit exceeded: ${txInDay}/${rule.maxTxPerDay} transactions per day (${rule.name})`;
        }
      }

      if (rule.cooldownMs !== undefined && history.length > 0) {
        const lastTx = history[history.length - 1];
        const elapsed = now - lastTx.timestamp;
        if (elapsed < rule.cooldownMs) {
          const waitSec = Math.ceil((rule.cooldownMs - elapsed) / 1000);
          return `Cooldown active: wait ${waitSec}s between transactions (${rule.name})`;
        }
      }

      // Check daily spending cap
      if (rule.maxDailySpendLamports !== undefined) {
        const dayAgo = now - 24 * 60 * 60 * 1000;
        const dailySpend = history
          .filter((h) => h.timestamp > dayAgo)
          .reduce((sum, h) => sum + h.lamports, 0);
        const txAmount = this.estimateTransferAmount(transaction);
        if (dailySpend + txAmount > rule.maxDailySpendLamports) {
          return `Daily spend limit would be exceeded: ${(dailySpend + txAmount) / LAMPORTS_PER_SOL} SOL > ${rule.maxDailySpendLamports / LAMPORTS_PER_SOL} SOL (${rule.name})`;
        }
      }

      // Check allowed programs
      if (rule.allowedPrograms && rule.allowedPrograms.length > 0) {
        for (const ix of transaction.instructions) {
          const programId = ix.programId.toBase58();
          if (!rule.allowedPrograms.includes(programId)) {
            return `Program ${programId} not in allowlist (${rule.name})`;
          }
        }
      }

      // Check blocked programs
      if (rule.blockedPrograms && rule.blockedPrograms.length > 0) {
        for (const ix of transaction.instructions) {
          const programId = ix.programId.toBase58();
          if (rule.blockedPrograms.includes(programId)) {
            return `Program ${programId} is blocked (${rule.name})`;
          }
        }
      }
    }

    return null;
  }

  /**
   * Record a completed transaction for rate limiting purposes.
   */
  recordTransaction(walletId: string, lamports: number = 0): void {
    if (!this.txHistory.has(walletId)) {
      this.txHistory.set(walletId, []);
    }
    this.txHistory.get(walletId)!.push({
      timestamp: Date.now(),
      lamports,
    });

    // Prune old entries (> 24h)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const history = this.txHistory.get(walletId)!;
    const pruned = history.filter((h) => h.timestamp > dayAgo);
    this.txHistory.set(walletId, pruned);
  }

  /**
   * Get transaction history for rate limit display.
   */
  getTransactionStats(walletId: string): {
    txLastHour: number;
    txLastDay: number;
    spendLastDay: number;
    lastTxTime: number | null;
  } {
    const history = this.txHistory.get(walletId) || [];
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    return {
      txLastHour: history.filter((h) => h.timestamp > hourAgo).length,
      txLastDay: history.filter((h) => h.timestamp > dayAgo).length,
      spendLastDay: history
        .filter((h) => h.timestamp > dayAgo)
        .reduce((s, h) => s + h.lamports, 0),
      lastTxTime:
        history.length > 0 ? history[history.length - 1].timestamp : null,
    };
  }

  /**
   * Create a standard devnet policy with sensible defaults.
   */
  static createDevnetPolicy(name: string = "devnet-safety"): Policy {
    return {
      id: `policy-${Date.now()}`,
      name,
      rules: [
        {
          name: "devnet-limits",
          maxLamportsPerTx: 2 * LAMPORTS_PER_SOL, // 2 SOL max per tx
          maxTxPerHour: 30,
          maxTxPerDay: 200,
          cooldownMs: 2000, // 2 seconds between txs
          maxDailySpendLamports: 10 * LAMPORTS_PER_SOL, // 10 SOL daily cap
          allowedPrograms: [
            "11111111111111111111111111111111", // System Program
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // Token Program
            "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", // Associated Token Account
            "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", // Jupiter v6
            "ComputeBudget111111111111111111111111111111", // Compute Budget
          ],
        },
      ],
      createdAt: new Date().toISOString(),
    };
  }

  // --- Helpers ---

  private estimateTransferAmount(transaction: Transaction): number {
    let total = 0;
    for (const ix of transaction.instructions) {
      if (ix.programId.equals(SystemProgram.programId)) {
        // Try to decode transfer instruction
        try {
          if (ix.data.length >= 12) {
            // SystemProgram transfer: first 4 bytes = instruction index (2 = transfer)
            // next 8 bytes = lamport amount (little-endian u64)
            const instructionType = ix.data.readUInt32LE(0);
            if (instructionType === 2) {
              total += Number(ix.data.readBigUInt64LE(4));
            }
          }
        } catch {
          // Can't decode, skip
        }
      }
    }
    return total;
  }
}
