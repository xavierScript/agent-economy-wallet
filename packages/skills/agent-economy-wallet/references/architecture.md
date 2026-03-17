# Agent Economy Wallet Architecture

The system is designed with multiple security isolation boundaries to ensure safe agentic interactions in web3.

## Packages

- **`@agent-economy-wallet/core`**: The foundational library. Contains the `WalletService`, `KeyManager`, `PolicyEngine`, and `X402Client/Server`.
  - Independent of any specific agent framework.
  - Directly responsible for safely encrypting and unlocking seeds in memory temporarily.
- **`@agent-economy/agent-economy-wallet-skill`** (OpenClaw): Exposes the foundational core logic as immediately accessible tool scripts for VM-bound agent instances. Designed specifically to work cleanly with Bash/TUI prompts and Node scripts.

## Core Flow

1. OpenClaw Agent queries `SKILL.md` to see what tools are available.
2. Agent identifies `x402-pay` is needed to pay for data.
3. Agent spawns `tsx scripts/x402-pay.ts`.
4. Script loads `WALLET_PASSPHRASE` from `.env`.
5. Script calls `@agent-economy-wallet/core`'s `X402Client`.
6. Client queries the shielded endpoint, parses the `.status == 402` headers, builds the SVM transaction.
7. Engine feeds the transaction through the local Guardrails policy engine.
8. If valid, the engine unlocks the private key into memory dynamically, signs, wipes the key, and broadcasts via `Connection()`.
9. The resulting token goes out, and `X402Client` retries the API payload.
10. The result string passes back to OpenClaw.
