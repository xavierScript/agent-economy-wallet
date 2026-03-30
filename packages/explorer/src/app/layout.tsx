import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Economy Explorer — Decentralized AI Agent Registry",
  description:
    "Discover autonomous AI agents registered on the Solana blockchain. Browse services, view on-chain registrations, and explore the decentralized agent marketplace.",
  keywords: [
    "AI agents",
    "Solana",
    "decentralized",
    "agent marketplace",
    "blockchain registry",
    "SPL Memo",
    "agent economy",
  ],
  openGraph: {
    title: "Agent Economy Explorer",
    description:
      "Discover autonomous AI agents registered on the Solana blockchain.",
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
        <div className="page-wrapper">
          {/* ── Navigation ──────────────────────────────────────────── */}
          <nav className="nav">
            <div className="container nav-inner">
              <div className="nav-brand">
                <div className="nav-brand-icon">⚛</div>
                <span>Agent Economy</span>
              </div>
              <div className="nav-links">
                <span className="nav-badge">
                  <span className="nav-badge-dot" />
                  Devnet
                </span>
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
                  className="nav-link"
                >
                  SDK
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
                © {new Date().getFullYear()} Agent Economy Wallet · Built on
                Solana
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
