import { mkdirSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * A single audit log entry.
 */
export interface AuditLogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Action performed (e.g., wallet:created, sol:transfer, swap:executed) */
  action: string;
  /** Wallet ID that performed the action */
  walletId?: string;
  /** Public key of the wallet */
  publicKey?: string;
  /** Transaction signature (if applicable) */
  txSignature?: string;
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message (if failed) */
  error?: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * AuditLogger writes every wallet operation to a JSONL file.
 * Provides an immutable audit trail for all agent wallet actions.
 *
 * Log format: one JSON object per line (JSONL)
 * Location: ~/.agentic-wallet/logs/audit-YYYY-MM-DD.jsonl
 */
export class AuditLogger {
  private logDir: string;
  private listeners: Array<(entry: AuditLogEntry) => void> = [];

  constructor(logDir: string) {
    this.logDir = logDir;
    mkdirSync(this.logDir, { recursive: true });
  }

  /**
   * Log an action. Automatically adds timestamp.
   */
  log(entry: Omit<AuditLogEntry, "timestamp">): void {
    const fullEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };

    // Write to file
    const dateStr = new Date().toISOString().split("T")[0];
    const filePath = join(this.logDir, `audit-${dateStr}.jsonl`);
    appendFileSync(filePath, JSON.stringify(fullEntry) + "\n", "utf-8");

    // Notify listeners (for real-time dashboard)
    for (const listener of this.listeners) {
      try {
        listener(fullEntry);
      } catch {
        // Don't crash on listener errors
      }
    }
  }

  /**
   * Register a listener for real-time log events.
   */
  onLog(listener: (entry: AuditLogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Read logs for a specific date.
   */
  readLogs(date?: string): AuditLogEntry[] {
    const dateStr = date || new Date().toISOString().split("T")[0];
    const filePath = join(this.logDir, `audit-${dateStr}.jsonl`);

    if (!existsSync(filePath)) return [];

    const content = readFileSync(filePath, "utf-8");
    return content
      .trim()
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as AuditLogEntry);
  }

  /**
   * Read recent logs (last N entries across all dates).
   */
  readRecentLogs(count: number = 50): AuditLogEntry[] {
    const today = new Date();
    const entries: AuditLogEntry[] = [];

    // Check last 7 days
    for (let i = 0; i < 7 && entries.length < count; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const dayLogs = this.readLogs(dateStr);
      entries.push(...dayLogs);
    }

    // Sort by timestamp descending, take last N
    return entries
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, count);
  }

  /**
   * Read logs filtered by wallet ID.
   */
  readWalletLogs(walletId: string, count: number = 50): AuditLogEntry[] {
    return this.readRecentLogs(count * 3)
      .filter((e) => e.walletId === walletId)
      .slice(0, count);
  }
}
