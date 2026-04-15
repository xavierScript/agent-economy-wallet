"use client";

import { useEffect, useState, useRef } from "react";

interface ActivityItem {
  type: "registration" | "payment";
  agent_name?: string;
  tx_signature: string;
  timestamp: string;
  network: string;
}

interface ActivityFeedProps {
  registryAddress: string;
  network: string;
}

function truncateSig(sig: string): string {
  if (sig.length <= 16) return sig;
  return `${sig.slice(0, 6)}…${sig.slice(-6)}`;
}

function timeAgo(isoDate: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / 1000,
  );
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function ActivityFeed({
  registryAddress,
  network,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchActivity() {
      try {
        const resp = await fetch("/api/registry");
        if (!resp.ok) return;
        const data = await resp.json();

        if (cancelled) return;

        const items: ActivityItem[] = (data.agents || []).map((agent: any) => ({
          type: "registration" as const,
          agent_name: agent.name,
          tx_signature: agent.registration_tx,
          timestamp: agent.registered_at,
          network: data.network || "Devnet",
        }));

        // Sort newest first
        items.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );

        setActivities(items.slice(0, 10));
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    fetchActivity();
    const interval = setInterval(fetchActivity, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [registryAddress]);

  const clusterParam = network === "Mainnet" ? "" : "?cluster=devnet";

  return (
    <div className="activity-feed">
      <div className="activity-feed-header">
        <h3 className="activity-feed-title">
          <span className="activity-pulse" />
          Live Activity
        </h3>
        <span className="activity-feed-count">
          {activities.length} events
        </span>
      </div>

      <div className="activity-feed-list" ref={feedRef}>
        {loading ? (
          <div className="activity-feed-empty">
            <span className="activity-loading-dot" />
            Scanning blockchain…
          </div>
        ) : activities.length === 0 ? (
          <div className="activity-feed-empty">No activity yet</div>
        ) : (
          activities.map((item, i) => (
            <div
              key={item.tx_signature}
              className="activity-item animate-card-enter"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="activity-item-icon">
                {item.type === "registration" ? "📡" : "💸"}
              </div>
              <div className="activity-item-content">
                <div className="activity-item-title">
                  <strong>{item.agent_name || "Unknown"}</strong> registered
                </div>
                <a
                  href={`https://explorer.solana.com/tx/${item.tx_signature}${clusterParam}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="activity-item-tx"
                >
                  {truncateSig(item.tx_signature)} ↗
                </a>
              </div>
              <span className="activity-item-time">
                {timeAgo(item.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
