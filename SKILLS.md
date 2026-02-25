# SKILLS.md — Agentic Wallet Skills Reference

> **For AI agents**: Start with the [main SKILL.md](packages/skills/SKILL.md) — it contains the complete guide with security rules, workflow, and all capabilities in one place.

This file indexes all skills available to AI agents interacting with the Solana Agentic Wallet system.

## Primary Skill File

📖 **[packages/skills/SKILL.md](packages/skills/SKILL.md)** — Comprehensive skill guide (OpenClaw-compatible)

## Reference Guides

Detailed documentation for each domain area:

| Reference                                                                | Description                                                     |
| ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| [references/setup.md](packages/skills/references/setup.md)               | Installation, environment variables, project setup              |
| [references/security.md](packages/skills/references/security.md)         | Encryption details, defense layers, prompt injection protection |
| [references/wallets.md](packages/skills/references/wallets.md)           | Create, list, fund, and manage agent wallets                    |
| [references/policies.md](packages/skills/references/policies.md)         | Transaction limits, policy templates, enforcement flow          |
| [references/transactions.md](packages/skills/references/transactions.md) | SOL transfers and SPL transfers                                 |
| [references/agents.md](packages/skills/references/agents.md)             | Autonomous agents (planned)                                     |

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
import { WalletService, SolanaConnection } from "@agentic-wallet/core";

const walletService = new WalletService();
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
            ├── KeyManager      — AES-256-GCM encrypted key storage
            ├── WalletService   — sign & send transactions
            ├── PolicyEngine    — safety guardrails (rate/spend limits)
            ├── SplTokenService — SPL token operations
            └── AuditLogger     — immutable JSONL audit trail
```
