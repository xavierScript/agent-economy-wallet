"use client";

import { useState, useEffect, useCallback } from "react";

interface WalletData {
  id: string;
  label: string;
  publicKey: string;
  createdAt: string;
}

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

interface DashboardData {
  cluster: string;
  rpcUrl: string;
  timestamp: string;
  wallets: WalletData[];
  recentLogs: LogEntry[];
  stats: {
    totalWallets: number;
    totalLogs: number;
    successfulTxns: number;
    failedTxns: number;
  };
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

function truncate(str: string, len: number = 20): string {
  if (str.length <= len) return str;
  return str.substring(0, len) + "...";
}

export default function DashboardPage() {
  const [time, setTime] = useState(new Date());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll every 5 seconds for live updates
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-solana-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--muted)]">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="card text-center max-w-md">
          <div className="text-red-400 text-lg mb-2">Connection Error</div>
          <p className="text-[var(--muted)] text-sm mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-solana-purple text-white rounded-lg text-sm hover:opacity-80"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const wallets = data?.wallets ?? [];
  const logs = data?.recentLogs ?? [];
  const stats = data?.stats ?? {
    totalWallets: 0,
    totalLogs: 0,
    successfulTxns: 0,
    failedTxns: 0,
  };
  const cluster = data?.cluster ?? "devnet";

  const successRate =
    stats.successfulTxns + stats.failedTxns > 0
      ? Math.round(
          (stats.successfulTxns / (stats.successfulTxns + stats.failedTxns)) *
            100,
        )
      : 100;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-[var(--muted)] text-sm">
            Real-time overview of your agentic wallet system
          </p>
        </div>
        <div className="text-right text-sm text-[var(--muted)]">
          <div>
            Cluster:{" "}
            <span className="text-solana-green font-medium">{cluster}</span>
          </div>
          <div>{time.toLocaleTimeString()}</div>
          {error && (
            <div className="text-yellow-400 text-xs mt-1">
              ⚠ Live updates paused
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Wallets"
          value={String(stats.totalWallets)}
          sub={`${wallets.length} active`}
          color="green"
        />
        <StatCard
          label="Audit Events"
          value={String(stats.totalLogs)}
          sub="across all wallets"
          color="purple"
        />
        <StatCard
          label="Successful Txns"
          value={String(stats.successfulTxns)}
          sub={`${successRate}% success rate`}
          color="blue"
        />
        <StatCard
          label="Failed Txns"
          value={String(stats.failedTxns)}
          sub={stats.failedTxns === 0 ? "No failures" : "Check logs"}
          color={stats.failedTxns > 0 ? "yellow" : "green"}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Wallets Card */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Wallets</h2>
          {wallets.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted)] text-sm">
              <p>No wallets found.</p>
              <p className="text-xs mt-1">
                Create one with:{" "}
                <code className="text-solana-green">
                  agentic-wallet wallet create
                </code>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {wallets.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between p-3 bg-black/20 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-white text-sm">
                      {w.label}
                    </div>
                    <div className="text-xs text-[var(--muted)] font-mono">
                      {truncate(w.publicKey, 24)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[var(--muted)]">
                      {timeAgo(w.createdAt)}
                    </div>
                    <div className="text-xs text-[var(--muted)] font-mono">
                      {w.id.substring(0, 8)}...
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Info Card */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">System Info</h2>
          <div className="space-y-3">
            <InfoRow label="Cluster" value={cluster} />
            <InfoRow label="RPC" value={truncate(data?.rpcUrl ?? "", 35)} />
            <InfoRow
              label="Last Update"
              value={
                data?.timestamp
                  ? new Date(data.timestamp).toLocaleTimeString()
                  : "-"
              }
            />
            <InfoRow
              label="Keystore"
              value={`${stats.totalWallets} wallet(s)`}
            />
            <InfoRow label="Audit Logs" value={`${stats.totalLogs} entries`} />
            <InfoRow
              label="Transactions"
              value={`${stats.successfulTxns} OK / ${stats.failedTxns} failed`}
            />
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          <span className="text-xs text-[var(--muted)]">
            Last {logs.length} events &bull; auto-refreshes every 5s
          </span>
        </div>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-[var(--muted)] text-sm">
            No activity yet. Run the demo or create a wallet to get started.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.slice(0, 25).map((log, i) => (
              <div
                key={`${log.timestamp}-${i}`}
                className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${log.success ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`}
                />
                <span className="text-xs text-[var(--muted)] w-16 flex-shrink-0">
                  {timeAgo(log.timestamp)}
                </span>
                <span className="text-sm font-medium text-white w-48 flex-shrink-0">
                  {log.action}
                </span>
                <span className="text-sm text-[var(--muted)] flex-shrink-0">
                  {log.walletId ? truncate(log.walletId, 12) : "\u2014"}
                </span>
                <span className="text-sm text-[var(--muted)] ml-auto text-right">
                  {log.txSignature
                    ? `tx: ${truncate(log.txSignature, 16)}`
                    : log.error
                      ? `\u274c ${truncate(log.error, 30)}`
                      : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    green: "from-green-500/10 to-transparent border-green-800/50",
    purple: "from-purple-500/10 to-transparent border-purple-800/50",
    blue: "from-blue-500/10 to-transparent border-blue-800/50",
    yellow: "from-yellow-500/10 to-transparent border-yellow-800/50",
  };

  return (
    <div className={`card bg-gradient-to-br ${colors[color] || colors.green}`}>
      <div className="text-xs text-[var(--muted)] mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-[var(--muted)] mt-1">{sub}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-sm text-white font-mono">{value}</span>
    </div>
  );
}
