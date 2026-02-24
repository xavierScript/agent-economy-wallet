import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * API endpoint for the dashboard to fetch system status.
 * Reads wallet keystores and audit logs directly from the filesystem.
 */
export async function GET() {
  const home = process.env.HOME || process.env.USERPROFILE || ".";
  const keystoreDir = path.join(home, ".agentic-wallet", "keys");
  const logDir = path.join(home, ".agentic-wallet", "logs");
  const cluster = process.env.SOLANA_CLUSTER || "devnet";
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

  // Read wallets from keystore directory
  const wallets: Array<{
    id: string;
    label: string;
    publicKey: string;
    createdAt: string;
  }> = [];
  try {
    if (fs.existsSync(keystoreDir)) {
      const files = fs
        .readdirSync(keystoreDir)
        .filter((f) => f.endsWith(".json"));
      for (const file of files) {
        try {
          const content = JSON.parse(
            fs.readFileSync(path.join(keystoreDir, file), "utf-8"),
          );
          wallets.push({
            id: content.id,
            label: content.label,
            publicKey: content.publicKey,
            createdAt: content.createdAt,
          });
        } catch {
          // Skip malformed keystores
        }
      }
    }
  } catch {
    // No keystore dir
  }

  // Read recent audit logs
  interface LogEntry {
    timestamp: string;
    action: string;
    walletId?: string;
    publicKey?: string;
    txSignature?: string;
    success: boolean;
    error?: string;
    details?: Record<string, unknown>;
  }
  const recentLogs: LogEntry[] = [];
  try {
    if (fs.existsSync(logDir)) {
      const logFiles = fs
        .readdirSync(logDir)
        .filter((f) => f.startsWith("audit-") && f.endsWith(".jsonl"))
        .sort()
        .reverse()
        .slice(0, 3); // Last 3 days

      for (const logFile of logFiles) {
        try {
          const content = fs.readFileSync(path.join(logDir, logFile), "utf-8");
          const entries = content
            .trim()
            .split("\n")
            .filter((line) => line.length > 0)
            .map((line) => JSON.parse(line) as LogEntry);
          recentLogs.push(...entries);
        } catch {
          // Skip malformed log files
        }
      }
    }
  } catch {
    // No log dir
  }

  // Sort logs descending by timestamp, take last 50
  recentLogs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const trimmedLogs = recentLogs.slice(0, 50);

  return NextResponse.json({
    cluster,
    rpcUrl,
    timestamp: new Date().toISOString(),
    wallets,
    recentLogs: trimmedLogs,
    stats: {
      totalWallets: wallets.length,
      totalLogs: recentLogs.length,
      successfulTxns: recentLogs.filter((l) => l.success && l.txSignature)
        .length,
      failedTxns: recentLogs.filter((l) => !l.success).length,
    },
  });
}
