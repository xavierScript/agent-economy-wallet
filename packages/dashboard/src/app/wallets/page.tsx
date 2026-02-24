"use client";

import { useState, useEffect, useCallback } from "react";

interface WalletData {
  id: string;
  label: string;
  publicKey: string;
  createdAt: string;
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

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      const json = await res.json();
      setWallets(json.wallets || []);
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
      <h1 className="text-2xl font-bold text-white mb-2">Wallets</h1>
      <p className="text-[var(--muted)] text-sm mb-6">
        All agent wallets managed by the system
      </p>

      {loading ? (
        <div className="text-[var(--muted)]">Loading...</div>
      ) : wallets.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[var(--muted)]">No wallets found.</p>
          <p className="text-xs text-[var(--muted)] mt-2">
            Create one with:{" "}
            <code className="text-solana-green">
              agentic-wallet wallet create
            </code>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {wallets.map((w) => (
            <div key={w.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {w.label}
                  </h3>
                  <p className="text-sm font-mono text-[var(--muted)] mt-1">
                    {w.publicKey}
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-2">
                    ID: <span className="font-mono">{w.id}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="badge-success">Active</span>
                  <p className="text-xs text-[var(--muted)] mt-2">
                    Created {timeAgo(w.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
