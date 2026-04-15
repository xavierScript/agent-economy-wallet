"use client";

import { useEffect, useCallback, useState } from "react";
import { type DiscoveredAgent, type AgentHealthStatus } from "@/lib/registry";

interface AgentModalProps {
  agent: DiscoveredAgent;
  onClose: () => void;
  healthStatus?: AgentHealthStatus;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

function truncateSig(sig: string): string {
  if (sig.length <= 20) return sig;
  return `${sig.slice(0, 8)}…${sig.slice(-8)}`;
}

const HEALTH_LABELS: Record<AgentHealthStatus, { text: string; color: string }> = {
  online: { text: "🟢 Online", color: "#22c55e" },
  slow: { text: "🟡 Slow", color: "#facc15" },
  offline: { text: "🔴 Offline", color: "#ef4444" },
};

export default function AgentModal({ agent, onClose, healthStatus }: AgentModalProps) {
  const [copied, setCopied] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const explorerUrl = `https://explorer.solana.com/tx/${agent.registration_tx}?cluster=devnet`;

  const copyAddress = () => {
    navigator.clipboard.writeText(agent.registered_by);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Calculate agent stats from services
  const totalServices = agent.services.length;
  const prices = agent.services
    .map((s: any) => s.price ?? s.cost ?? 0)
    .filter((p: number) => p > 0);
  const avgPrice = prices.length > 0
    ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length
    : 0;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-title-group">
            <div
              className="agent-avatar"
              style={{
                background: `linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))`,
              }}
            >
              {agent.name.charAt(0)}
            </div>
            <div>
              <h2 className="modal-title">{agent.name}</h2>
              {healthStatus && (
                <span
                  className="modal-health"
                  style={{ color: HEALTH_LABELS[healthStatus].color }}
                >
                  {HEALTH_LABELS[healthStatus].text}
                </span>
              )}
            </div>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Quick Stats */}
          <div className="modal-section">
            <div className="modal-quick-stats">
              <div className="modal-stat-mini">
                <span className="modal-stat-mini-value">{totalServices}</span>
                <span className="modal-stat-mini-label">Services</span>
              </div>
              <div className="modal-stat-mini">
                <span className="modal-stat-mini-value">
                  {avgPrice > 0 ? `$${avgPrice.toFixed(4)}` : "Free"}
                </span>
                <span className="modal-stat-mini-label">Avg Price</span>
              </div>
              <div className="modal-stat-mini">
                <span className="modal-stat-mini-value">
                  {healthStatus === "online" ? "✓" : healthStatus === "slow" ? "~" : "✗"}
                </span>
                <span className="modal-stat-mini-label">Status</span>
              </div>
            </div>
          </div>

          {/* Registration Info */}
          <div className="modal-section">
            <h3 className="modal-section-title">Registration Info</h3>
            <div className="info-row">
              <span className="info-label">Wallet</span>
              <span className="info-value">
                <button
                  className="copy-btn"
                  onClick={copyAddress}
                  title="Copy full address"
                >
                  {truncateAddress(agent.registered_by)}
                  <span className="copy-icon">{copied ? "✓" : "⧉"}</span>
                </button>
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Registered</span>
              <span className="info-value">
                {agent.registered_at !== "unknown"
                  ? new Date(agent.registered_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Unknown"}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Transaction</span>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="info-value info-link"
              >
                {truncateSig(agent.registration_tx)} ↗
              </a>
            </div>
            <div className="info-row">
              <span className="info-label">Manifest</span>
              <a
                href={agent.manifest_url}
                target="_blank"
                rel="noopener noreferrer"
                className="info-value info-link"
              >
                View manifest.json ↗
              </a>
            </div>
          </div>

          {/* Services */}
          <div className="modal-section">
            <h3 className="modal-section-title">
              Services ({agent.services.length})
            </h3>
            <div className="service-list">
              {agent.services.map((svc: any, i: number) => (
                <div key={i} className="service-item">
                  <div className="service-item-header">
                    <div className="service-name">
                      {svc.name || `Service #${i + 1}`}
                    </div>
                    {(svc.price !== undefined || svc.cost !== undefined) && (
                      <span className="service-price">
                        ◎{" "}
                        {svc.price ?? svc.cost}{" "}
                        {svc.currency || "USDC"}
                      </span>
                    )}
                  </div>
                  {svc.description && (
                    <div className="service-desc">{svc.description}</div>
                  )}
                  {svc.endpoint && (
                    <div
                      className="service-desc"
                      style={{ marginTop: "6px", fontFamily: "var(--font-mono)" }}
                    >
                      <span className="service-method">
                        {svc.method || "GET"}
                      </span>
                      {svc.endpoint}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
