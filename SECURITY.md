# Security Policy

## 🔒 Core Security Principles

The **Agent Economy Wallet** was built from the ground up to securely accommodate autonomous AI agents traversing the Solana blockchain.

1. **Ephemeral Key Handling:** Private keys exist uniquely in function scope during signing operations. They are never returned in cleartext, securely zeroed out post-operation, and are never logged or stored in memory longer than necessary.
2. **Deterministic Policies:** Hard limits exist to ensure buyer agents cannot drain wallets due to LLM hallucinations or prompt injection. Actions are constrained strictly by your predefined agent policy configuration.
3. **On-Chain Verification:** Merchant agents establish their authenticity and legitimacy on-chain. The x402-gated HTTP server transactions ensure merchant identities cannot be spoofed across the Agent Economy.

