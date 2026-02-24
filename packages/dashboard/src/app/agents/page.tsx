"use client";

export default function CapabilitiesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Capabilities</h1>
      <p className="text-[var(--muted)] text-sm mb-6">
        What this agentic wallet can do on Solana devnet
      </p>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Core Features
        </h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          The wallet SDK provides encrypted key management, transaction signing,
          policy enforcement, and protocol interactions — all designed for
          autonomous AI agents.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <FeatureCard
            name="Create Wallets"
            description="Generate Solana keypairs with AES-256-GCM encrypted storage and PBKDF2 key derivation"
            color="green"
          />
          <FeatureCard
            name="Sign & Send"
            description="Automatically sign and send transactions with policy enforcement and audit logging"
            color="blue"
          />
          <FeatureCard
            name="Hold Tokens"
            description="Hold SOL and SPL tokens with balance queries and token account management"
            color="purple"
          />
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Protocol Interactions
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <FeatureCard
            name="Send SOL"
            description="Transfer SOL to any address with policy-enforced limits and audit trail"
            color="green"
          />
          <FeatureCard
            name="Send SPL Tokens"
            description="Transfer SPL tokens with automatic Associated Token Account creation"
            color="blue"
          />
          <FeatureCard
            name="On-Chain Memos"
            description="Write permanent memos via the SPL Memo program — the simplest dApp interaction"
            color="purple"
          />
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">
          Try It via CLI
        </h2>
        <div className="space-y-3">
          <CodeBlock
            label="Create a wallet"
            code="agentic-wallet wallet create --label my-wallet"
          />
          <CodeBlock
            label="Send SOL"
            code={`agentic-wallet send sol <walletId> <recipientAddress> 0.1`}
          />
          <CodeBlock
            label="Write an on-chain memo"
            code={`agentic-wallet memo <walletId> "Hello from my AI agent!"`}
          />
          <CodeBlock
            label="View audit logs"
            code="agentic-wallet logs"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  name,
  description,
  color,
}: {
  name: string;
  description: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    green: "border-green-800/50",
    blue: "border-blue-800/50",
    purple: "border-purple-800/50",
  };

  return (
    <div className={`card border ${colors[color] || ""}`}>
      <h3 className="text-white font-semibold mb-1">{name}</h3>
      <p className="text-xs text-[var(--muted)]">{description}</p>
    </div>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="bg-black/30 rounded-lg p-3">
      <div className="text-xs text-[var(--muted)] mb-1">{label}</div>
      <code className="text-sm text-solana-green">{code}</code>
    </div>
  );
}
