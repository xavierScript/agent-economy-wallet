"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  RegistrySnapshot,
  DiscoveredAgent,
  AgentHealthStatus,
} from "@/lib/registry";
import AgentGrid from "./AgentGrid";
import AgentModal from "./AgentModal";
import SearchFilter, { type SortOption } from "./SearchFilter";
import ActivityFeed from "./ActivityFeed";
import HowItWorks from "./HowItWorks";

interface DashboardProps {
  snapshot: RegistrySnapshot;
}

export default function Dashboard({ snapshot: initialSnapshot }: DashboardProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedAgent, setSelectedAgent] = useState<DiscoveredAgent | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [healthMap, setHealthMap] = useState<
    Record<string, AgentHealthStatus>
  >({});
  const [isLive, setIsLive] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // ── Live polling ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const resp = await fetch("/api/registry");
        if (!resp.ok) return;
        const data = await resp.json();
        if (!cancelled && data.agents) {
          setSnapshot(data);
          setLastRefresh(new Date());
          setIsLive(true);
        }
      } catch {
        if (!cancelled) setIsLive(false);
      }
    }

    const interval = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // ── Agent health checks ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      const map: Record<string, AgentHealthStatus> = {};
      for (const agent of snapshot.agents) {
        try {
          const start = Date.now();
          const resp = await fetch(
            `/api/registry?health=${encodeURIComponent(agent.manifest_url)}`,
            { signal: AbortSignal.timeout(5000) },
          );
          const latency = Date.now() - start;

          if (!cancelled) {
            map[agent.manifest_url] =
              !resp.ok ? "offline" : latency > 2000 ? "slow" : "online";
          }
        } catch {
          if (!cancelled) map[agent.manifest_url] = "offline";
        }
      }
      if (!cancelled) setHealthMap(map);
    }

    // Only check if we have agents
    if (snapshot.agents.length > 0) {
      // Set initial optimistic state
      const optimistic: Record<string, AgentHealthStatus> = {};
      snapshot.agents.forEach((a) => {
        optimistic[a.manifest_url] = "online";
      });
      setHealthMap(optimistic);
    }

    return () => {
      cancelled = true;
    };
  }, [snapshot.agents]);

  // ── Filtering + sorting ────────────────────────────────────────────────
  const filteredAgents = useCallback(() => {
    let agents = [...snapshot.agents];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      agents = agents.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.registered_by.toLowerCase().includes(q) ||
          a.services.some(
            (s: any) =>
              s.name?.toLowerCase().includes(q) ||
              s.description?.toLowerCase().includes(q),
          ),
      );
    }

    // Sort
    switch (sortBy) {
      case "newest":
        agents.sort(
          (a, b) =>
            new Date(b.registered_at).getTime() -
            new Date(a.registered_at).getTime(),
        );
        break;
      case "services":
        agents.sort((a, b) => b.services.length - a.services.length);
        break;
      case "name":
        agents.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return agents;
  }, [snapshot.agents, searchQuery, sortBy]);

  const displayAgents = filteredAgents();

  // ── Compute enhanced stats ─────────────────────────────────────────────
  const avgPrice = snapshot.agents.length > 0
    ? snapshot.agents.reduce((sum, a) => {
        const prices = a.services
          .map((s: any) => s.price ?? s.cost ?? 0)
          .filter((p: number) => p > 0);
        return sum + (prices.length > 0 ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0);
      }, 0) / snapshot.agents.length
    : 0;

  const newestRegistration = snapshot.agents.length > 0
    ? snapshot.agents.reduce((latest, a) => {
        const t = new Date(a.registered_at).getTime();
        return t > new Date(latest.registered_at).getTime() ? a : latest;
      })
    : null;

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="hero">
        <span className="hero-eyebrow">
          <span className={`live-dot ${isLive ? "live-dot-active" : ""}`} />
          {isLive ? "Live" : "Syncing"} · Solana {snapshot.network}
        </span>
        <h1>
          <span className="hero-gradient-text">Agent Economy</span>
          <br />
          Explorer
        </h1>
        <p>
          The first decentralized marketplace for autonomous AI agent services
          on Solana. Discover, evaluate, and pay — all on-chain.
        </p>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <section className="container">
        <div className="stats-grid stats-grid-6">
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
            <div className="stat-label">Registrations</div>
            <div className="stat-value">{snapshot.total_registrations}</div>
            <div className="stat-sub">on-chain memos</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Service Price</div>
            <div className="stat-value" style={{ fontSize: "1.4rem" }}>
              {avgPrice > 0
                ? `$${avgPrice.toFixed(4)}`
                : "—"}
            </div>
            <div className="stat-sub">USDC per request</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Protocol Fee</div>
            <div className="stat-value" style={{ fontSize: "1.4rem" }}>
              0.5%
            </div>
            <div className="stat-sub">on every payment</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Last Updated</div>
            <div className="stat-value" style={{ fontSize: "1.2rem" }}>
              {lastRefresh.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
            <div className="stat-sub">auto-refreshes every 30s</div>
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────── */}
      <section className="container">
        <HowItWorks />
      </section>

      {/* ── Main Content: Directory + Activity Feed ────────────────── */}
      <section className="container section">
        <div className="dashboard-grid">
          {/* Left: Agent directory */}
          <div className="dashboard-main">
            <div className="section-header">
              <h2 className="section-title">Agent Directory</h2>
              <span className="section-count">
                {snapshot.agents.length} agent
                {snapshot.agents.length !== 1 ? "s" : ""} on-chain
              </span>
            </div>
            <SearchFilter
              onSearch={setSearchQuery}
              onSort={setSortBy}
              activeSort={sortBy}
              resultCount={displayAgents.length}
              totalCount={snapshot.agents.length}
            />
            <AgentGrid
              agents={displayAgents}
              onSelect={setSelectedAgent}
              healthMap={healthMap}
            />
          </div>

          {/* Right: Activity feed */}
          <aside className="dashboard-sidebar">
            <ActivityFeed
              registryAddress={snapshot.registry_address}
              network={snapshot.network}
            />
          </aside>
        </div>
      </section>

      {/* ── Modal ─────────────────────────────────────────────────── */}
      {selectedAgent && (
        <AgentModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          healthStatus={healthMap[selectedAgent.manifest_url]}
        />
      )}
    </>
  );
}
