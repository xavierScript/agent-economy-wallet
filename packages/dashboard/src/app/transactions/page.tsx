"use client";

import { useState, useEffect, useCallback } from "react";

interface LogEntry {
  timestamp: string;
  action: string;
  walletId?: string;
  txSignature?: string;
  success: boolean;
  details?: Record<string, unknown>;
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function TransactionsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      const json = await res.json();
      // Filter to only transaction-related entries
      const txLogs = (json.recentLogs || []).filter(
        (l: LogEntry) => l.txSignature,
      );
      setLogs(txLogs);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Transactions</h1>
      <p className="text-[var(--muted)] text-sm mb-6">
        All on-chain transactions signed by agent wallets
      </p>

      {loading ? (
        <div className="text-[var(--muted)]">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[var(--muted)]">No transactions yet.</p>
          <p className="text-xs text-[var(--muted)] mt-2">
            Run the demo to generate transactions on devnet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log, i) => (
            <div key={`${log.timestamp}-${i}`} className="card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${log.success ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`}
                  />
                  <span className="text-white font-medium">{log.action}</span>
                  <span
                    className={log.success ? "badge-success" : "badge-error"}
                  >
                    {log.success ? "Success" : "Failed"}
                  </span>
                </div>
                <span className="text-xs text-[var(--muted)]">
                  {timeAgo(log.timestamp)}
                </span>
              </div>
              <div className="ml-6 space-y-1">
                {log.txSignature && (
                  <div className="text-xs">
                    <span className="text-[var(--muted)]">Signature: </span>
                    <a
                      href={`https://explorer.solana.com/tx/${log.txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-solana-green hover:underline"
                    >
                      {log.txSignature.substring(0, 40)}...
                    </a>
                  </div>
                )}
                {log.walletId && (
                  <div className="text-xs">
                    <span className="text-[var(--muted)]">Wallet: </span>
                    <span className="font-mono text-white">
                      {log.walletId.substring(0, 12)}...
                    </span>
                  </div>
                )}
                {log.details && (
                  <div className="text-xs text-[var(--muted)] mt-1">
                    {JSON.stringify(log.details)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
