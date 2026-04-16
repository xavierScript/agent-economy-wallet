# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly. **Do not open a public issue.**

<!-- TODO: Add security contact email -->
Contact: Open a private security advisory via [GitHub Security Advisories](https://github.com/xavierScript/agent-economy-wallet/security/advisories/new).

## Security Architecture

The Yanga Wallet implements defense-in-depth security for autonomous AI agents managing on-chain funds.

### Key Encryption

- Private keys encrypted at rest using **AES-256-GCM** with PBKDF2-derived keys (210,000 iterations, SHA-512).
- Keys are decrypted in function scope during signing operations only — never returned in cleartext, never logged.
- AI agents receive public key references only. Raw seed phrases are never exposed to the LLM context.

### Spending Policy Engine

- **Per-transaction caps** — maximum SOL or token amount per transfer.
- **Daily spending limits** — rolling 24-hour caps on total outbound value.
- **Rate limiting** — maximum transactions per hour.
- **Whitelist enforcement** — restrict interactions to known addresses.
- **Human-in-the-loop** — high-value transfers require operator approval via the CLI.

Rejected transactions are blocked **before signing** and logged to the tamper-evident audit trail.

### x402 Payment Verification

- On-chain verification of every USDC payment signature.
- Anti-replay LRU cache prevents signature reuse.
- Stateless validation — payment proofs are Solana transaction signatures, independently verifiable.

### On-Chain Registry

- Immutable SPL Memo registrations — cannot be altered after confirmation.
- Wallet-attributed entries — cryptographic proof of authorship.
- No central authority — no admin key, no governance token, no censorship mechanism.

### Wallet Closure

- `close_wallet` is **intentionally excluded** from MCP tool registration.
- Only human operators can close wallets via the CLI.
- Remaining SOL is swept to the configured `OWNER_ADDRESS`.

> For the full security architecture, see the [Security Documentation](https://xavierscript.mintlify.app/security).
