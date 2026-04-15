"use client";

import { type DiscoveredAgent, type AgentHealthStatus } from "@/lib/registry";

interface AgentGridProps {
  agents: DiscoveredAgent[];
  onSelect: (agent: DiscoveredAgent) => void;
  healthMap?: Record<string, AgentHealthStatus>;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function timeAgo(isoDate: string): string {
  if (isoDate === "unknown") return "Unknown";
  const seconds = Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / 1000,
  );
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function agentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${(hue + 40) % 360}, 80%, 45%))`;
}

const STATUS_CONFIG: Record<
  AgentHealthStatus,
  { dot: string; label: string; color: string }
> = {
  online: { dot: "health-dot-online", label: "Online", color: "#22c55e" },
  slow: { dot: "health-dot-slow", label: "Slow", color: "#facc15" },
  offline: { dot: "health-dot-offline", label: "Offline", color: "#ef4444" },
};

export default function AgentGrid({ agents, onSelect, healthMap }: AgentGridProps) {
  if (agents.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <h3>No Agents Discovered</h3>
        <p>
          No agents are currently registered on-chain, or their manifests are
          offline. Register an agent using the SDK to see it appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="agent-grid">
      {agents.map((agent, i) => {
        const health = healthMap?.[agent.manifest_url];
        const statusCfg = health ? STATUS_CONFIG[health] : null;

        return (
          <div
            key={agent.registration_tx}
            className="agent-card animate-card-enter"
            style={{ animationDelay: `${i * 80}ms` }}
            onClick={() => onSelect(agent)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelect(agent);
            }}
          >
            <div className="agent-card-header">
              <div
                className="agent-avatar"
                style={{ background: agentColor(agent.name) }}
              >
                {agent.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="agent-name">{agent.name}</div>
                <div className="agent-wallet">
                  {truncateAddress(agent.registered_by)}
                </div>
              </div>
              {statusCfg && (
                <div className="health-badge" title={statusCfg.label}>
                  <span className={`health-dot ${statusCfg.dot}`} />
                  <span className="health-label">{statusCfg.label}</span>
                </div>
              )}
            </div>

            <div className="agent-card-body">
              <div className="agent-services">
                {agent.services.slice(0, 4).map((svc: any, j: number) => (
                  <span key={j} className="service-tag">
                    {svc.name || svc.endpoint || `Service ${j + 1}`}
                  </span>
                ))}
                {agent.services.length > 4 && (
                  <span className="service-tag">
                    +{agent.services.length - 4} more
                  </span>
                )}
              </div>
            </div>

            <div className="agent-card-footer">
              <span className="agent-meta">
                Registered{" "}
                <span className="agent-meta-accent">
                  {timeAgo(agent.registered_at)}
                </span>
                {" · "}
                <span className="agent-meta-accent">
                  {agent.services.length} service{agent.services.length !== 1 ? "s" : ""}
                </span>
              </span>
              <span className="view-details-btn">
                View <span>→</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
