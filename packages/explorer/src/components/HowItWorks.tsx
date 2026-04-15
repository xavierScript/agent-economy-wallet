"use client";

const STEPS = [
  {
    number: "01",
    icon: "🔍",
    title: "Discover",
    tool: "discover_registry",
    description: "Scans Solana for registered merchants via SPL Memo",
  },
  {
    number: "02",
    icon: "📋",
    title: "Read Manifest",
    tool: "read_manifest",
    description: "Fetches /.well-known/agent.json from a merchant",
  },
  {
    number: "03",
    icon: "⭐",
    title: "Check Reputation",
    tool: "check_reputation",
    description: "Queries on-chain reputation — success rate, volume",
  },
  {
    number: "04",
    icon: "🏷️",
    title: "Probe Price",
    tool: "probe_x402",
    description: "Confirms price on the x402-gated endpoint",
  },
  {
    number: "05",
    icon: "🛡️",
    title: "Policy Check",
    tool: "policy_engine",
    description: "Wallet policy engine approves the spend",
  },
  {
    number: "06",
    icon: "💸",
    title: "Pay",
    tool: "pay_x402_invoice",
    description: "USDC payment → Solana tx confirmed on-chain",
  },
  {
    number: "07",
    icon: "✅",
    title: "Data Returned",
    tool: "response",
    description: "Purchased data returned to the agent autonomously",
  },
];

export default function HowItWorks() {
  return (
    <section className="how-it-works">
      <div className="how-it-works-header">
        <span className="how-eyebrow">The Protocol</span>
        <h2 className="how-title">
          Autonomous Agent-to-Agent Payments
        </h2>
        <p className="how-subtitle">
          No human touches steps 1–7. AI agents discover, evaluate, pay, and
          receive data — all on Solana.
        </p>
      </div>

      <div className="how-steps-grid">
        {STEPS.map((step, i) => (
          <div
            key={step.number}
            className="how-step-card animate-card-enter"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="how-step-number">{step.number}</div>
            <div className="how-step-icon">{step.icon}</div>
            <h3 className="how-step-title">{step.title}</h3>
            <code className="how-step-tool">{step.tool}</code>
            <p className="how-step-desc">{step.description}</p>
            {i < STEPS.length - 1 && (
              <div className="how-step-connector" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
