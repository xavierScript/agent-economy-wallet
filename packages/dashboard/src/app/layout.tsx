import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentic Wallet Dashboard",
  description: "Monitor and manage Solana AI agent wallets",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-64 bg-[#0b1120] border-r border-[var(--card-border)] p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-solana-purple to-solana-green flex items-center justify-center text-white font-bold text-sm">
                AW
              </div>
              <div>
                <h1 className="font-bold text-white">Agentic Wallet</h1>
                <p className="text-xs text-[var(--muted)]">
                  Solana Agent Dashboard
                </p>
              </div>
            </div>

            <nav className="space-y-1 flex-1">
              <NavItem label="Overview" href="/" active />
              <NavItem label="Wallets" href="/wallets" />
              <NavItem label="Agents" href="/agents" />
              <NavItem label="Transactions" href="/transactions" />
              <NavItem label="Audit Logs" href="/logs" />
            </nav>

            <div className="mt-auto pt-4 border-t border-[var(--card-border)]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                <span className="text-xs text-[var(--muted)]">
                  Devnet Connected
                </span>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-8 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}

function NavItem({
  label,
  href,
  active = false,
}: {
  label: string;
  href: string;
  active?: boolean;
}) {
  return (
    <a
      href={href}
      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? "bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
          : "text-[var(--muted)] hover:text-white hover:bg-white/5"
      }`}
    >
      {label}
    </a>
  );
}
