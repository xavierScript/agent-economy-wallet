# Agentic Wallet — Architecture & Security Deep Dive

This document covers the design decisions, security model, and technical architecture behind the Solana Agentic Wallet. It is intended for bounty reviewers, auditors, and developers who want to understand _why_ the system is built the way it is.

---

## Table of Contents

1. [Core Problem: Agents Need Wallets, Wallets Need Safety](#1-core-problem)
2. [Why MCP Instead of a Raw SDK](#2-why-mcp)
3. [Security Model: Key Storage](#3-key-storage)
4. [Security Model: Policy Engine](#4-policy-engine)
5. [Security Model: Human-Only Guardrail](#5-human-only-guardrail)
6. [Audit Trail](#6-audit-trail)
7. [Transaction Pipeline](#7-transaction-pipeline)
8. [Jupiter Integration](#8-jupiter-integration)
9. [Multi-Agent Architecture](#9-multi-agent-architecture)
10. [What Agents Can and Cannot Do](#10-agent-capabilities)
11. [Threat Model](#11-threat-model)

---

## 1. Core Problem

AI agents that act on Solana need wallets. But a wallet designed for human use is dangerous in agent hands:

- Humans confirm transactions visually. Agents do not.
- Humans notice when something is wrong. Agents may loop.
- Humans have intent. Agents follow instructions that can be injected.

The goal was to build a wallet that is genuinely useful to agents (autonomous, fast, protocol-capable) while being safe by design — not by hope.

---

## 2. Why MCP Instead of a Raw SDK

The obvious approach is to give an agent a TypeScript SDK and let it call `walletService.sendSol(...)` directly. We chose Model Context Protocol (MCP) instead for five reasons:

### 2.1 Separation of concerns

With a raw SDK, the agent has direct in-process access to the `WalletService` and could, in theory, call any method — including ones that aren't safe for agent use. MCP creates a **hard process boundary**: the agent calls a named tool with a JSON schema; a separate server process validates, executes, and returns a structured response. The agent never holds a reference to the wallet objects.

### 2.2 Universal agent compatibility

MCP is supported by Claude Desktop, VS Code Copilot, Cursor, and any custom agent built with the MCP SDK. Writing one MCP server means zero integration work per agent framework. A raw SDK would require a custom integration for every framework.

### 2.3 Schema-enforced inputs

Every tool's input is validated by a Zod schema before the handler runs. An agent cannot pass a malformed `wallet_id`, a negative `amount`, or an out-of-range `slippage_bps`. With a raw SDK, input validation is the agent's problem.

### 2.4 Declarative capability surface

MCP tools, resources, and prompts are declared with titles, descriptions, and annotations (`readOnlyHint`, `destructiveHint`). Agents can read this metadata and reason about what they're allowed to do. A raw SDK exposes every public method equally.

### 2.5 Resources and prompts as first-class primitives

MCP resources let agents read live state (wallet balances, policies, audit logs) without calling a tool — they are read-only and have no side effects. MCP prompts provide pre-built multi-step workflows (`trading-strategy`, `portfolio-rebalance`, `security-audit`) that guide agents through complex operations with built-in safety checks baked in. Neither concept exists in a raw SDK pattern.

---

## 3. Key Storage

Private keys are the most sensitive asset in the system. The design principle is: **keys exist in plaintext only in memory, only during signing, and for the minimum possible duration.**

### Keystore format

Each wallet is stored as a JSON file: `~/.agentic-wallet/keys/<uuid>.json`. The format is inspired by Ethereum's Web3 Secret Storage Definition, adapted for Solana Ed25519 keys:

```
{
  id:         UUID (wallet identifier)
  label:      human-readable name
  publicKey:  base58 — safe to expose
  crypto: {
    cipher:   "aes-256-gcm"
    ciphertext: hex — the 64-byte Ed25519 private key, encrypted
    iv:       hex — 16-byte random initialization vector
    authTag:  hex — 16-byte GCM authentication tag
    kdf:      "pbkdf2"
    kdfparams: {
      iterations: 210,000    ← OWASP minimum for PBKDF2-HMAC-SHA512
      salt:       hex        ← 32 bytes, unique per keystore
      dklen:      32         ← 256-bit derived key
      digest:     "sha512"
    }
  }
}
```

### Key derivation

The AES encryption key is never stored. It is derived on demand from `WALLET_PASSPHRASE` using:

```
DerivedKey = PBKDF2(HMAC-SHA512, passphrase, salt, 210_000 iterations, 32 bytes)
```

210,000 iterations is the current OWASP recommendation for PBKDF2-HMAC-SHA512. Each keystore has its own random 32-byte salt, so compromising one keystore's password derivation does not affect others.

### GCM authentication

AES-256-GCM provides both confidentiality and integrity. The 16-byte auth tag prevents silent tampering — if someone modifies the ciphertext on disk, decryption will throw rather than return a corrupted key.

### File permissions

After writing a keystore, `chmod 0600` is applied so only the owner process can read it.

### In-memory lifetime

`KeyManager.unlockWallet()` decrypts the key, constructs the `Keypair`, signs the transaction, and returns. The plaintext key bytes are not cached. The GC reclaims them after the signing closure exits.

---

## 4. Policy Engine

The `PolicyEngine` is the first line of defense against runaway or compromised agents. Every transaction is checked **before** it is signed.

### What a policy contains

```typescript
interface PolicyRule {
  name: string;
  maxLamportsPerTx?: number; // per-transaction spend cap
  maxTxPerHour?: number; // rate limit (hourly)
  maxTxPerDay?: number; // rate limit (daily)
  cooldownMs?: number; // minimum gap between transactions
  maxDailySpendLamports?: number; // rolling 24h spend cap
  allowedPrograms?: string[]; // program allowlist (whitelist)
  blockedPrograms?: string[]; // program blocklist (blacklist)
}
```

Each wallet can have one policy with multiple rules. All rules must pass.

### Default devnet policy

Every wallet created through the MCP server receives this policy automatically — it cannot be skipped:

- Max 2 SOL per transaction
- Max 10 transactions per hour
- Max 50 transactions per day
- 2-second cooldown between transactions
- Max 10 SOL daily spend

### Check flow

```
signAndSendTransaction(walletId, tx, context)
        │
        ▼
PolicyEngine.checkTransaction(walletId, tx, context)
        │
        ├── [no policy attached] → allow, log warning
        │
        ├── [rule: maxLamportsPerTx] → parse SystemProgram transfers, sum lamports
        │
        ├── [rule: maxTxPerHour/Day] → count tx history in rolling window
        │
        ├── [rule: cooldownMs] → compare now vs last tx timestamp
        │
        ├── [rule: maxDailySpendLamports] → sum lamports in last 24h + this tx
        │
        ├── [rule: allowedPrograms] → check each instruction's programId
        │
        └── [rule: blockedPrograms] → check each instruction's programId
                │
                ├── violation → AuditLogger.log(action, success=false, error=violation)
                │               throw new Error(`Policy violation: ${violation}`)
                │
                └── all pass → sign + send
```

### Versioned transactions (Jupiter)

Jupiter swaps use `VersionedTransaction` with address lookup tables (ALTs). Decoding all instructions from a versioned tx requires resolving the ALTs on-chain, which is expensive and adds latency. For versioned transactions we use `PolicyEngine.checkLimits()` instead — this enforces rate limits, cooldowns, and the daily spend cap using the caller-provided `estimatedLamports`, but skips program allowlist checks. This is an acceptable tradeoff for DEX swaps since slippage and price impact are already bounded separately.

### State persistence

Policy state (attached policies + transaction history) is persisted to `~/.agentic-wallet/policy-state.json`. Rate limit counters survive server restarts — an agent cannot bypass the hourly limit by restarting the MCP server.

---

## 5. Human-Only Guardrail

Closing a wallet is **irreversible**: the encrypted keystore is permanently deleted and any remaining balance is swept. This is not a decision that should be delegated to an AI agent.

### The technique

`walletService.closeWallet()` requires a third parameter typed as `{ humanInitiated: true }` — not `boolean`, but the **literal type** `true`:

```typescript
async closeWallet(
  walletId: string,
  sweepToAddress: string | undefined,
  opts: HumanOnlyOpts,   // { humanInitiated: true }
): Promise<...>
```

This is a compile-time barrier. MCP tool handlers receive their arguments from a Zod schema. Zod's `z.boolean()` produces the type `boolean` — which does not satisfy `{ humanInitiated: true }`. TypeScript will refuse to compile any tool handler that tries to call `closeWallet`.

The CLI passes `HUMAN_ONLY` explicitly:

```typescript
import { HUMAN_ONLY } from "@agentic-wallet/core";
walletService.closeWallet(id, ownerAddress, HUMAN_ONLY);
```

The `close_wallet` tool file is kept in the repo with a prominent warning header but is **not registered** in `tools/index.ts`. The comment block in that file explains exactly why it must never be re-added.

### Scope of the pattern

The `HumanOnlyOpts` type and `HUMAN_ONLY` constant are exported from `@agentic-wallet/core` (via `guardrails/human-only.ts`) so they can be applied to any future operations that need the same protection — for example, a future `update_policy` tool that could allow an agent to loosen its own spending limits.

---

## 6. Audit Trail

Every operation — success or failure — is written to an append-only JSONL file:

```
~/.agentic-wallet/logs/audit-YYYY-MM-DD.jsonl
```

Each line is a JSON object:

```json
{
  "timestamp": "2026-03-01T12:34:56.789Z",
  "action": "swap:jupiter",
  "walletId": "a1b2c3d4-...",
  "publicKey": "7xKXtg...",
  "txSignature": "5vGk...",
  "success": true,
  "details": {
    "inputToken": "SOL",
    "outputToken": "USDC",
    "inputAmount": 0.1,
    "slippageBps": 50
  }
}
```

The logger uses `appendFileSync` — it cannot overwrite existing entries. Actions logged include:

| Action                  | When                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `wallet:created`        | New wallet keypair generated                               |
| `wallet:closed`         | Keystore deleted                                           |
| `wallet:sweep`          | SOL swept before close                                     |
| `sol:transfer`          | SOL sent                                                   |
| `spl-token:transfer`    | SPL tokens sent                                            |
| `spl-token:create-mint` | New token mint created                                     |
| `spl-token:mint`        | Tokens minted                                              |
| `swap:jupiter`          | Jupiter swap executed                                      |
| `memo:write`            | On-chain memo written                                      |
| `airdrop:request`       | Devnet airdrop requested                                   |
| _(any action)_ — failed | Policy violation or RPC error logged with `success: false` |

The `AuditLogger` supports real-time event listeners, which the CLI TUI uses to stream new entries into the logs view without polling.

---

## 7. Transaction Pipeline

### Legacy transactions (SOL transfers, SPL tokens, memos, mints)

```
Tool handler
  → TransactionBuilder / SplTokenService builds Transaction
  → WalletService.signAndSendTransaction()
      → PolicyEngine.checkTransaction()        [reject if violation]
      → KeyManager.unlockWallet()              [decrypt key]
      → get latest blockhash
      → transaction.sign(keypair)
      → conn.sendRawTransaction()
      → conn.confirmTransaction('confirmed')
      → AuditLogger.log(success=true)
      → PolicyEngine.recordTransaction()       [update rate limit state]
  → return txSignature
```

### Versioned transactions (Jupiter swaps)

```
Tool handler
  → JupiterService.getQuote()                 [Jupiter v6 API]
  → validate priceImpactPct < maxPriceImpactPct
  → JupiterService.buildSwapTransaction()     [Jupiter v6 API → VersionedTransaction]
  → WalletService.signAndSendVersionedTransaction()
      → PolicyEngine.checkLimits()             [rate limits + daily cap]
      → KeyManager.unlockWallet()
      → transaction.sign([keypair])
      → conn.sendRawTransaction()
      → conn.confirmTransaction('confirmed')
      → AuditLogger.log(success=true)
      → PolicyEngine.recordTransaction(estimatedLamports)
  → return txSignature
```

### Sweep-and-close (human-initiated only)

```
CLI confirms 'y' from human
  → walletService.closeWallet(id, ownerAddress, HUMAN_ONLY)
      → get current balance
      → build fee-calculation transaction (getFeeForMessage)
      → send sweepAmount = balance - exactFee to ownerAddress
      → confirmTransaction
      → AuditLogger.log('wallet:sweep')
      → PolicyEngine.removePolicy(walletId)    [policy cleared]
      → KeyManager.deleteWallet(walletId)      [keystore file deleted]
      → AuditLogger.log('wallet:closed')
```

---

## 8. Jupiter Integration

Jupiter is Solana's primary DEX aggregator — it routes swaps across Raydium, Orca, Meteora, and other liquidity sources to find the best price. The integration uses Jupiter's v6 REST API.

### Flow

1. **Quote** — `GET /quote?inputMint=...&outputMint=...&amount=...&slippageBps=...`  
   Returns best route, expected output, price impact, and route labels.

2. **Validate** — price impact is checked against `maxPriceImpactPct` (default 5%). Swaps with higher impact are rejected before any transaction is built.

3. **Build** — `POST /swap` with the quote + wallet public key.  
   Jupiter returns a base64-encoded `VersionedTransaction` with ALT-compressed instructions.

4. **Sign + send** — via `signAndSendVersionedTransaction` with rate/spend limits enforced.

### Safety parameters

| Parameter            | Default   | Purpose                                    |
| -------------------- | --------- | ------------------------------------------ |
| `defaultSlippageBps` | 50 (0.5%) | Default slippage tolerance                 |
| `maxSlippageBps`     | 300 (3%)  | Agent cannot request more than this        |
| `maxPriceImpactPct`  | 5%        | Rejects swaps with excessive market impact |

---

## 9. Multi-Agent Architecture

The system is designed for multiple independent agents, each with their own wallet:

- **Independent keystores** — each wallet is a separate encrypted file with its own salt/IV
- **Independent policies** — each wallet has its own spend cap, rate limits, and program allowlist
- **Independent audit trails** — log entries include `walletId` so per-agent activity is filterable
- **Shared MCP server** — one server instance manages all wallets; agents are differentiated by the `wallet_id` they supply

The `portfolio-rebalance` prompt demonstrates multi-wallet coordination: it reads all wallet balances, calculates target allocations, and orchestrates `send_sol` calls between wallets.

---

## 10. What Agents Can and Cannot Do

### Can do (via MCP tools)

- Create wallets (always with devnet safety policy — cannot be skipped)
- Query balances and wallet state
- Send SOL and SPL tokens (policy-checked)
- Execute Jupiter swaps (policy-checked, slippage/impact bounded)
- Write on-chain memos
- Create and mint SPL tokens
- Request devnet airdrops (max 2 SOL)
- Read audit logs, system status, policies

### Cannot do

- **Close wallets** — `closeWallet` requires `{ humanInitiated: true }` literal type; no MCP tool can satisfy this
- **Bypass policies** — policy checks happen inside `WalletService` before signing; tool handlers have no way to skip them
- **Access raw keypairs** — `KeyManager.unlockWallet()` is not exposed via any tool
- **Read the passphrase** — `system/config` resource redacts it
- **Create policy-free wallets** — `create_wallet` always attaches the devnet safety policy; `attach_policy` flag was removed from the MCP tool

---

## 11. Threat Model

| Threat                                   | Mitigation                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Compromised agent / prompt injection** | Policy engine blocks out-of-limit transactions regardless of what the agent was instructed to do        |
| **Runaway agent loop**                   | Rate limits (10 tx/hr, 50 tx/day) and cooldown (2s) halt runaway execution before significant damage    |
| **Large single transaction**             | Per-tx cap (2 SOL default) prevents draining in one call                                                |
| **Gradual drain over time**              | Daily spend cap (10 SOL default) bounds 24h exposure                                                    |
| **Agent closing wallets**                | Compile-time `HumanOnlyOpts` guard; `close_wallet` not registered on MCP server                         |
| **Agent loosening its own policy**       | No `update_policy` tool exists; policy changes require direct code access                               |
| **Keystore file exfiltration**           | Keys are AES-256-GCM encrypted; attacker needs the passphrase to decrypt                                |
| **Passphrase brute force**               | PBKDF2 at 210,000 iterations makes brute force computationally expensive                                |
| **Keystore tampering**                   | GCM auth tag detects modification; decryption throws on tampered ciphertext                             |
| **Multiple agents racing**               | Each wallet has its own policy state; per-wallet rate limit tracking prevents cross-wallet interference |
| **Devnet vs mainnet confusion**          | `SOLANA_CLUSTER` defaults to `devnet`; mainnet requires explicit opt-in                                 |
| **x402 overspend**                       | Configurable `maxPaymentLamports`; PolicyEngine rate/spend limits enforced before signing x402 payments |
