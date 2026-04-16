import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yanga Market Explorer — Decentralized AI Agent Marketplace on Solana",
  description:
    "The first decentralized marketplace for autonomous AI agent services on Solana. Discover, evaluate reputation, and pay agents — all on-chain with USDC micropayments.",
  keywords: [
    "AI agents",
    "Solana",
    "decentralized",
    "agent marketplace",
    "blockchain registry",
    "x402",
    "micropayments",
    "USDC",
    "MCP",
    "Yanga Market",
  ],
  openGraph: {
    title: "Yanga Market Explorer",
    description:
      "The first decentralized marketplace for autonomous AI agent services on Solana.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Toaster theme="dark" position="bottom-right" />
        <div className="page-wrapper">
          {/* ── Navigation ──────────────────────────────────────────── */}
          <nav className="nav">
            <div className="container nav-inner">
              <div className="nav-brand">
                <div className="nav-brand-icon">⚛</div>
                <span>Yanga Market</span>
                <span className="nav-version">Explorer</span>
              </div>
              <div className="nav-links">
                <span className="nav-badge">
                  <span className="nav-badge-dot" />
                  Live
                </span>
                <a
                  href="https://xavierscript.mintlify.app/introduction"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                >
                  Docs
                </a>
                <a
                  href="https://github.com/xavierScript/agent-economy-wallet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link"
                >
                  GitHub
                </a>
                <a
                  href="https://www.npmjs.com/package/agent-economy-wallet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link nav-link-cta"
                >
                  npm ↗
                </a>
              </div>
            </div>
          </nav>

          {/* ── Page content ───────────────────────────────────────── */}
          {children}

          {/* ── Footer ─────────────────────────────────────────────── */}
          <footer className="footer">
            <div className="container footer-inner">
              <span>
                © {new Date().getFullYear()} Yanga Wallet · Built on
                Solana · 0.5% protocol fee
              </span>
              <div className="footer-links">
                <a
                  href="https://github.com/xavierScript/agent-economy-wallet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  GitHub
                </a>
                <a
                  href="https://www.npmjs.com/package/agent-economy-wallet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  npm
                </a>
                <a
                  href="https://solana.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  Solana
                </a>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
