"use client";

import { useState, useEffect, useCallback } from "react";

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

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      const json = await res.json();
      setLogs(json.recentLogs || []);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filtered = logs.filter((l) => {
    if (filter === "success") return l.success;
    if (filter === "failed") return !l.success;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Audit Logs</h1>
          <p className="text-[var(--muted)] text-sm">
            Immutable JSONL audit trail of all wallet operations
          </p>
        </div>
        <div className="flex gap-2">
          {(["all", "success", "failed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-[var(--accent)] text-white"
                  : "bg-white/5 text-[var(--muted)] hover:text-white"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-[var(--muted)]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[var(--muted)]">No logs found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log, i) => (
            <div key={`${log.timestamp}-${i}`} className="card py-3 px-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${log.success ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`}
                />
                <span className="text-xs text-[var(--muted)] w-20 flex-shrink-0">
                  {timeAgo(log.timestamp)}
                </span>
                <span className="text-sm font-medium text-white w-52 flex-shrink-0">
                  {log.action}
                </span>
                <span className="text-xs font-mono text-[var(--muted)] flex-shrink-0">
                  {log.walletId ? log.walletId.substring(0, 12) + "..." : "—"}
                </span>
                {log.txSignature && (
                  <a
                    href={`https://explorer.solana.com/tx/${log.txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-solana-green hover:underline ml-auto"
                  >
                    {log.txSignature.substring(0, 20)}...
                  </a>
                )}
                {log.error && (
                  <span className="text-xs text-red-400 ml-auto">
                    {log.error.substring(0, 50)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
