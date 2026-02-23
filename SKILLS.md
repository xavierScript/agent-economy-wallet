# SKILLS.md — Agentic Wallet Skills Reference

This file describes all skills available to AI agents interacting with the Solana Agentic Wallet system. Each skill corresponds to a specific action an agent can perform.

## Available Skills

| Skill                                                       | Description                                        | User Invocable |
| ----------------------------------------------------------- | -------------------------------------------------- | -------------- |
| [create-wallet](packages/skills/create-wallet/SKILL.md)     | Create a new encrypted Solana wallet               | ✅             |
| [send-sol](packages/skills/send-sol/SKILL.md)               | Transfer SOL with policy enforcement               | ✅             |
| [send-spl-token](packages/skills/send-spl-token/SKILL.md)   | Transfer SPL tokens with auto ATA creation         | ✅             |
| [swap-tokens](packages/skills/swap-tokens/SKILL.md)         | Swap via on-chain AMM (devnet) / Jupiter (mainnet) | ✅             |
| [check-balance](packages/skills/check-balance/SKILL.md)     | Query SOL & token balances                         | ✅             |
| [airdrop-devnet](packages/skills/airdrop-devnet/SKILL.md)   | Request devnet SOL for testing                     | ✅             |
| [manage-agents](packages/skills/manage-agents/SKILL.md)     | Spawn/stop autonomous trading agents               | ✅             |
| [view-audit-logs](packages/skills/view-audit-logs/SKILL.md) | View the immutable audit trail                     | ✅             |

## Skill Format

Each skill follows the [OpenClaw AgentSkills](https://docs.openclaw.ai) format with YAML frontmatter:

```yaml
---
name: skill-name
description: What the skill does
user-invocable: true
disable-model-invocation: false
allowed-tools:
  - agentic-wallet-cli
---
```

## Agent Integration

Skills are designed to work with any AI agent framework:

### Direct CLI Usage

```bash
agentic-wallet wallet create --label "my-agent"
agentic-wallet swap <walletId> --from SOL --to USDC --amount 100000000
```

### Programmatic SDK

```typescript
import { WalletService, DevnetSwapClient } from "@agentic-wallet/core";
import { AgentOrchestrator } from "@agentic-wallet/agent-engine";

// Use any skill programmatically
const wallet = await walletService.createWallet("my-agent", policy);
const sig = await walletService.requestAirdrop(wallet.id, 2);
```

### LangChain / AutoGPT / Custom Agents

Each SKILL.md includes both CLI commands and TypeScript code examples. Your agent can:

1. Read the SKILL.md to understand available actions
2. Execute via CLI or import the SDK directly
3. Use the audit log to verify results

## Architecture

```
AI Agent (any framework)
    │
    ├── reads SKILL.md files for capabilities
    │
    ├── executes via CLI: `agentic-wallet <command>`
    │
    └── OR imports SDK: `@agentic-wallet/core`
            │
            ├── KeyManager (encrypted key storage)
            ├── WalletService (sign & send)
            ├── PolicyEngine (safety guardrails)
            ├── ISwapClient (protocol-agnostic swaps)
            ├── DevnetSwapClient (on-chain AMM) / JupiterClient (mainnet)
            ├── SplTokenService (token ops)
            └── AuditLogger (immutable trail)
```
