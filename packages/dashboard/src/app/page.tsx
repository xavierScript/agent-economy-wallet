"use client";

import { useState, useEffect } from "react";

// Mock data for demo (will be replaced with real API/WebSocket)
const MOCK_WALLETS = [
  {
    id: "wallet-1",
    label: "DCA Agent",
    publicKey: "7xKXtg2CnuEqutD...",
    balanceSol: 2.45,
    tokens: 3,
  },
  {
    id: "wallet-2",
    label: "Rebalance Agent",
    publicKey: "9aTpV2wsdWHk7m2...",
    balanceSol: 5.12,
    tokens: 5,
  },
  {
    id: "wallet-3",
    label: "Arb Scanner",
    publicKey: "3nFqWbZi67yuKh...",
    balanceSol: 1.08,
    tokens: 1,
  },
];

const MOCK_AGENTS = [
  {
    id: "agent-1",
    name: "SOL→USDC DCA",
    strategy: "dca",
    status: "running",
    ticks: 142,
    walletId: "wallet-1",
  },
  {
    id: "agent-2",
    name: "Portfolio 60/40",
    strategy: "rebalance",
    status: "running",
    ticks: 87,
    walletId: "wallet-2",
  },
  {
    id: "agent-3",
    name: "SOL/USDC Arb",
    strategy: "arbitrage",
    status: "paused",
    ticks: 56,
    walletId: "wallet-3",
  },
];

const MOCK_LOGS = [
  {
    time: "2m ago",
    action: "dca:swapped",
    success: true,
    wallet: "DCA Agent",
    detail: "0.1 SOL → 4.23 USDC",
  },
  {
    time: "5m ago",
    action: "rebalance:balanced",
    success: true,
    wallet: "Rebalance Agent",
    detail: "Portfolio within threshold",
  },
  {
    time: "8m ago",
    action: "arbitrage:no-opportunity",
    success: true,
    wallet: "Arb Scanner",
    detail: "+0.02% (below 0.3% min)",
  },
  {
    time: "12m ago",
    action: "dca:swapped",
    success: true,
    wallet: "DCA Agent",
    detail: "0.1 SOL → 4.25 USDC",
  },
  {
    time: "15m ago",
    action: "airdrop:received",
    success: true,
    wallet: "DCA Agent",
    detail: "2 SOL airdrop",
  },
];

export default function DashboardPage() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const totalBalance = MOCK_WALLETS.reduce((s, w) => s + w.balanceSol, 0);
  const runningAgents = MOCK_AGENTS.filter(
    (a) => a.status === "running",
  ).length;
  const totalTicks = MOCK_AGENTS.reduce((s, a) => s + a.ticks, 0);

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
            <span className="text-solana-green font-medium">devnet</span>
          </div>
          <div>{time.toLocaleTimeString()}</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Balance"
          value={`${totalBalance.toFixed(2)} SOL`}
          sub="~$xxx USD"
          color="green"
        />
        <StatCard
          label="Active Wallets"
          value={String(MOCK_WALLETS.length)}
          sub="3 with tokens"
          color="purple"
        />
        <StatCard
          label="Running Agents"
          value={`${runningAgents}/${MOCK_AGENTS.length}`}
          sub={`${totalTicks} total ticks`}
          color="blue"
        />
        <StatCard
          label="Transactions Today"
          value="28"
          sub="100% success rate"
          color="yellow"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Agents Card */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">
            Active Agents
          </h2>
          <div className="space-y-3">
            {MOCK_AGENTS.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between p-3 bg-black/20 rounded-lg"
              >
                <div>
                  <div className="font-medium text-white text-sm">
                    {agent.name}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {agent.strategy} • {agent.ticks} ticks
                  </div>
                </div>
                <span
                  className={
                    agent.status === "running"
                      ? "badge-success"
                      : "badge-warning"
                  }
                >
                  {agent.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Wallets Card */}
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Wallets</h2>
          <div className="space-y-3">
            {MOCK_WALLETS.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between p-3 bg-black/20 rounded-lg"
              >
                <div>
                  <div className="font-medium text-white text-sm">
                    {w.label}
                  </div>
                  <div className="text-xs text-[var(--muted)] font-mono">
                    {w.publicKey}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-solana-green">
                    {w.balanceSol.toFixed(2)} SOL
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {w.tokens} tokens
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">
          Recent Activity
        </h2>
        <div className="space-y-2">
          {MOCK_LOGS.map((log, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <div
                className={`w-2 h-2 rounded-full ${log.success ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`}
              />
              <span className="text-xs text-[var(--muted)] w-16">
                {log.time}
              </span>
              <span className="text-sm font-medium text-white w-48">
                {log.action}
              </span>
              <span className="text-sm text-[var(--muted)]">{log.wallet}</span>
              <span className="text-sm text-[var(--muted)] ml-auto">
                {log.detail}
              </span>
            </div>
          ))}
        </div>
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
