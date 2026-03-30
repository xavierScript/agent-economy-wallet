"use client";

import { type DiscoveredAgent } from "@/lib/registry";

interface AgentGridProps {
  agents: DiscoveredAgent[];
  onSelect: (agent: DiscoveredAgent) => void;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
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

export default function AgentGrid({ agents, onSelect }: AgentGridProps) {
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
      {agents.map((agent, i) => (
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
            <div>
              <div className="agent-name">{agent.name}</div>
              <div className="agent-wallet">
                {truncateAddress(agent.registered_by)}
              </div>
            </div>
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
            </span>
            <span className="view-details-btn">
              View Details <span>→</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
