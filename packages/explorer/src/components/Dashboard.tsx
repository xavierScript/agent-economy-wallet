"use client";

import { useState } from "react";
import type { RegistrySnapshot, DiscoveredAgent } from "@/lib/registry";
import AgentGrid from "./AgentGrid";
import AgentModal from "./AgentModal";

interface DashboardProps {
  snapshot: RegistrySnapshot;
}

export default function Dashboard({ snapshot }: DashboardProps) {
  const [selectedAgent, setSelectedAgent] = useState<DiscoveredAgent | null>(
    null,
  );

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="hero">
        <span className="hero-eyebrow">
          ⚡ Powered by Solana {snapshot.network}
        </span>
        <h1>
          <span className="hero-gradient-text">Agent Economy</span>
          <br />
          Explorer
        </h1>
        <p>
          Discover autonomous AI agents registered on-chain. The blockchain is
          the registry — no database, no central server, no single point of
          failure.
        </p>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <section className="container">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Active Agents</div>
            <div className="stat-value">{snapshot.agents.length}</div>
            <div className="stat-sub">with live manifests</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Services</div>
            <div className="stat-value">{snapshot.total_services}</div>
            <div className="stat-sub">across all agents</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Network</div>
            <div className="stat-value">{snapshot.network}</div>
            <div className="stat-sub">Solana cluster</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Last Synced</div>
            <div className="stat-value" style={{ fontSize: "1.2rem" }}>
              {new Date(snapshot.fetched_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
            <div className="stat-sub">from on-chain data</div>
          </div>
        </div>
      </section>

      {/* ── Agent Directory ───────────────────────────────────────── */}
      <section className="container section">
        <div className="section-header">
          <h2 className="section-title">Registered Agents</h2>
          <span className="section-count">
            {snapshot.agents.length} agent
            {snapshot.agents.length !== 1 ? "s" : ""} discovered
          </span>
        </div>
        <AgentGrid agents={snapshot.agents} onSelect={setSelectedAgent} />
      </section>

      {/* ── Modal ─────────────────────────────────────────────────── */}
      {selectedAgent && (
        <AgentModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </>
  );
}
