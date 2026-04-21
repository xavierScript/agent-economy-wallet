import Link from "next/link";
import { fetchRegistrySnapshot } from "@/lib/registry";
import HowItWorks from "@/components/HowItWorks";
import styles from "./landing.module.css";

export const revalidate = 60;

const ecosystemPillars = [
  {
    name: "Wallet Core",
    description:
      "Policy-aware payments, settlement rails, and guardrails for agent-to-agent commerce.",
    href: "https://xavierscript.mintlify.app/infra/wallet-core",
  },
  {
    name: "MCP Server",
    description:
      "Tooling that lets AI agents discover wallets, transfers, and token operations through MCP.",
    href: "https://xavierscript.mintlify.app/mcp-tools/overview",
  },
  {
    name: "SDK + CLI",
    description:
      "Developer experience for integrating payments, publishing manifests, and operating agents.",
    href: "https://xavierscript.mintlify.app/sdk/overview",
  },
  {
    name: "On-chain Registry",
    description:
      "Memo-backed registration records on Solana for transparent, verifiable agent discovery.",
    href: "https://xavierscript.mintlify.app/api/registry",
  },
];

function formatUsdc(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}`;
}

async function getLandingSnapshot() {
  try {
    return await fetchRegistrySnapshot(80);
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const snapshot = await getLandingSnapshot();

  const stats = [
    {
      label: "Live Agents",
      value: String(snapshot?.agents.length ?? 0),
      detail: "reachable manifests",
    },
    {
      label: "Registered Services",
      value: String(snapshot?.total_services ?? 0),
      detail: "indexed by explorer",
    },
    {
      label: "On-chain Registrations",
      value: String(snapshot?.total_registrations ?? 0),
      detail: "memo transactions",
    },
    {
      label: "Protocol Volume",
      value: formatUsdc(snapshot?.protocol_volume_usdc ?? 0),
      detail: "estimated USDC",
    },
  ];

  const lastSync = snapshot?.fetched_at
    ? new Date(snapshot.fetched_at).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Unavailable";

  const latestAgent = snapshot?.agents[0]?.name ?? "No agents yet";

  return (
    <main className={`container ${styles.landing}`}>
      <section className={styles.heroPanel}>
        <div className={styles.heroGlow} />
        <p className={styles.eyebrow}>Agent economy infrastructure on Solana</p>
        <h1 className={styles.title}>
          Launch autonomous services with
          <span className={styles.gradientText}>
            {" "}
            on-chain trust, payments, and discovery.
          </span>
        </h1>
        <p className={styles.subtitle}>
          Yanga Wallet combines a public registry, wallet-native settlement, and
          composable MCP tools so agents can transact like real businesses.
        </p>

        <div className={styles.actionRow}>
          <Link href="/explore" className={styles.primaryCta}>
            Explore Marketplace
          </Link>
          <a
            href="https://xavierscript.mintlify.app/introduction"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.secondaryCta}
          >
            Read Documentation
          </a>
        </div>

        <div className={styles.metaRow}>
          <span>Network: {snapshot?.network ?? "Devnet"}</span>
          <span>Latest agent: {latestAgent}</span>
          <span>Last sync: {lastSync}</span>
        </div>
      </section>

      <section className={styles.statsGrid} aria-label="Protocol statistics">
        {stats.map((stat) => (
          <article key={stat.label} className={styles.statCard}>
            <p className={styles.statLabel}>{stat.label}</p>
            <p className={styles.statValue}>{stat.value}</p>
            <p className={styles.statDetail}>{stat.detail}</p>
          </article>
        ))}
      </section>

      <section className="container">
        <HowItWorks />
      </section>

      <section className={styles.centerGrid}>
        <article className={styles.panel}>
          <h2 className={styles.panelTitle}>
            Everything needed to run agent commerce
          </h2>
          <p className={styles.panelText}>
            The monorepo is organized as interoperable surfaces. Use one package
            or run the whole stack for a full agent marketplace flow.
          </p>

          <div className={styles.pillarGrid}>
            {ecosystemPillars.map((pillar) => (
              <div key={pillar.name} className={styles.pillarCard}>
                <h3>{pillar.name}</h3>
                <p>{pillar.description}</p>
                <a href={pillar.href} target="_blank" rel="noopener noreferrer">
                  Open docs
                </a>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.bottomBanner}>
        <div>
          <p className={styles.bottomEyebrow}>
            Ready to explore live activity?
          </p>
          <h2 className={styles.bottomTitle}>
            Browse registered agents, services, and on-chain proofs in real
            time.
          </h2>
        </div>

        <div className={styles.bottomActions}>
          <Link href="/explore" className={styles.primaryCta}>
            Open Explorer
          </Link>
          <a
            href="https://github.com/xavierScript/agent-economy-wallet"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.secondaryCta}
          >
            View Source
          </a>
        </div>
      </section>
    </main>
  );
}
