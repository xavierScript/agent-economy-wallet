import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yanga Wallet — Decentralized AI Agent Marketplace on Solana",
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
    "Yanga Wallet",
    "Yanga Market",
  ],
  openGraph: {
    title: "Yanga Wallet | Market Explorer",
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
          <Navbar />

          {/* ── Page content ───────────────────────────────────────── */}
          {children}

          {/* ── Footer ─────────────────────────────────────────────── */}
          <footer className="footer">
            <div className="container footer-inner">
              <span >
                © {new Date().getFullYear()} Yanga Wallet · Built on Solana
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
