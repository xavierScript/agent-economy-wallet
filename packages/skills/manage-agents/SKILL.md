---
name: manage-agents
description: Spawn, monitor, pause, and stop autonomous trading agents with configurable strategies
---

# Manage Agents

Manage autonomous AI agents that execute trading strategies with their own wallets. Agents run on configurable tick intervals and support DCA, rebalance, liquidity, and arbitrage strategies.

## When to Use

- Starting an autonomous DCA (dollar-cost averaging) agent
- Spawning a portfolio rebalancing agent
- Monitoring running agents and their performance
- Stopping or pausing agents

## Commands

### Spawn an Agent

```bash
agentic-wallet agent spawn \
  --name "My DCA Agent" \
  --wallet <walletId> \
  --strategy dca \
  --interval 60000 \
  --config '{"inputMint":"So11111111111111111111111111111111111111112","outputMint":"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU","amountPerSwap":100000000}'
```

### List Agents

```bash
agentic-wallet agent list
```

### Stop an Agent

```bash
agentic-wallet agent stop <agentId>
```

## Available Strategies

| Strategy    | Description                 | Key Config                                               |
| ----------- | --------------------------- | -------------------------------------------------------- |
| `dca`       | Dollar-cost averaging       | `inputMint`, `outputMint`, `amountPerSwap`, `intervalMs` |
| `rebalance` | Portfolio rebalancing       | `targets: [{mint, targetWeight}]`, `driftThreshold`      |
| `liquidity` | LP monitoring               | `tokenA`, `tokenB`, `maxSlippage`                        |
| `arbitrage` | Price discrepancy detection | `tokenMint`, `minProfitBps`, `tradeAmount`               |

## Programmatic Usage

```typescript
import { AgentOrchestrator } from "@agentic-wallet/agent-engine";

const orchestrator = new AgentOrchestrator(walletService, swapClient);

// Spawn a DCA agent
const agent = await orchestrator.spawnAgent({
  name: "SOL-to-USDC DCA",
  walletId: wallet.id,
  strategyName: "dca",
  strategyConfig: {
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    amountPerSwap: 100_000_000,
    intervalMs: 60_000,
  },
  tickIntervalMs: 30_000,
});

// Listen to events
orchestrator.onEvent((event) => {
  console.log(`[${event.type}] Agent ${event.agentId}:`, event.data);
});

// Stop all agents
await orchestrator.stopAll();
```
