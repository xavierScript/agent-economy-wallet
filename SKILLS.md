# SKILLS.md — Agentic Wallet Skills Reference

> **For AI agents**: Start with the [main SKILL.md](skills/SKILL.md) — it contains the complete guide with security rules, workflow, and all capabilities in one place.

This file indexes all skills available to AI agents interacting with the Solana Agentic Wallet system.

## Primary Skill File

📖 **[skills/SKILL.md](skills/SKILL.md)** — Comprehensive skill guide (OpenClaw-compatible)

## Reference Guides

Detailed documentation for each domain area:

| Reference                                                       | Description                                                      |
| --------------------------------------------------------------- | ---------------------------------------------------------------- |
| [references/setup.md](skills/references/setup.md)               | Installation, environment variables, MCP server & CLI setup      |
| [references/security.md](skills/references/security.md)         | Encryption details, defense layers, prompt injection protection  |
| [references/wallets.md](skills/references/wallets.md)           | Create, list, fund, and manage agent wallets                     |
| [references/policies.md](skills/references/policies.md)         | Transaction limits, policy templates, enforcement flow           |
| [references/transactions.md](skills/references/transactions.md) | SOL/SPL transfers, Jupiter swaps, memos, airdrops, token minting |

## Skill Format

Skills follow the [OpenClaw AgentSkills](https://docs.openclaw.ai) format with YAML frontmatter:

```yaml
---
name: agentic-wallet
description: Solana wallet SDK with encrypted keys and policy guardrails
category: crypto
tags: [solana, wallet, security]
---
```

## Agent Integration

Skills support any AI agent framework — Claude, Cursor, OpenClaw, Windsurf, LangChain, AutoGPT, or custom.

### Direct CLI

```bash
agentic-wallet wallet create --label "my-agent"
agentic-wallet send sol <walletId> <recipientAddress> 0.5
```

### TypeScript SDK

```typescript
import { createCoreServices } from "@agentic-wallet/core";

const { walletService, policyEngine } = createCoreServices();
const policy = policyEngine.constructor.createDevnetPolicy("my-agent-policy");
const wallet = await walletService.createWallet("my-agent", policy);
```

### Architecture

```
AI Agent (any framework)
    │
    ├── reads SKILL.md → understands capabilities + security rules
    │
    ├── CLI: agentic-wallet <command>
    │
    └── SDK: @agentic-wallet/core
            │
            ├── KeyManager       — AES-256-GCM encrypted key storage
            ├── WalletService    — sign & send transactions (legacy + versioned)
            ├── PolicyEngine     — safety guardrails (rate/spend limits, allowlists)
            ├── AuditLogger      — immutable JSONL audit trail
            ├── protocols/
            │   ├── SplTokenService    — SPL token/mint operations
            │   ├── TransactionBuilder — SOL, SPL, memo tx builders
            │   └── JupiterService     — DEX aggregator swaps (Jupiter v6)
            └── createCoreServices()  — single-call bootstrap factory
```
