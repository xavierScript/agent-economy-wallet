"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="nav">
      <div className="container nav-inner">
        <Link href="/" className="nav-brand">
          <div className="nav-brand-icon">⚛</div>
          <span>Yanga Wallet</span>
        </Link>

        {/* Desktop Links */}
        <div className="nav-links">
          <span className="nav-badge">
            <span className="nav-badge-dot" />
            Live
          </span>
          <Link href="/" className="nav-link">
            Home
          </Link>
          <Link href="/explore" className="nav-link nav-link-cta">
            Explore
          </Link>
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
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="mobile-menu-btn"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-panel">
          <div className="mobile-menu-links">
            <Link
              href="/"
              className="mobile-nav-link"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/explore"
              className="mobile-nav-link mobile-nav-link-cta"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Explore Dashboard
            </Link>
            <a
              href="https://xavierscript.mintlify.app/introduction"
              target="_blank"
              rel="noopener noreferrer"
              className="mobile-nav-link"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Documentation
            </a>
            <a
              href="https://github.com/xavierScript/agent-economy-wallet"
              target="_blank"
              rel="noopener noreferrer"
              className="mobile-nav-link"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              GitHub Source
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
