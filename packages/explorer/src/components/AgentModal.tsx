"use client";

import { useEffect, useCallback } from "react";
import { type DiscoveredAgent } from "@/lib/registry";

interface AgentModalProps {
  agent: DiscoveredAgent;
  onClose: () => void;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function truncateSig(sig: string): string {
  if (sig.length <= 20) return sig;
  return `${sig.slice(0, 8)}...${sig.slice(-8)}`;
}

export default function AgentModal({ agent, onClose }: AgentModalProps) {
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
            <h2 className="modal-title">{agent.name}</h2>
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
          {/* Registration Info */}
          <div className="modal-section">
            <h3 className="modal-section-title">Registration Info</h3>
            <div className="info-row">
              <span className="info-label">Wallet</span>
              <span className="info-value">
                {truncateAddress(agent.registered_by)}
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
                  <div className="service-name">
                    {svc.name || `Service #${i + 1}`}
                  </div>
                  {svc.description && (
                    <div className="service-desc">{svc.description}</div>
                  )}
                  {(svc.price !== undefined || svc.cost !== undefined) && (
                    <span className="service-price">
                      ◎{" "}
                      {svc.price ?? svc.cost}{" "}
                      {svc.currency || "SOL"}
                    </span>
                  )}
                  {svc.endpoint && (
                    <div
                      className="service-desc"
                      style={{ marginTop: "6px", fontFamily: "var(--font-mono)" }}
                    >
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
