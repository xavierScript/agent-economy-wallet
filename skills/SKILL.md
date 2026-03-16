# Agent Skill Reference — Detailed Instructions

> This document provides step-by-step instructions for every tool, executable script, resource, and workflow available to AI agents operating the Solana Agent Economy Wallet system. It covers both the MCP server interface and standalone bash scripts — use whichever access path is available to you.

---

## Table of Contents

1. [Tool Reference](#tool-reference)
2. [Executable Scripts](#executable-scripts)
3. [Workflow Playbooks](#workflow-playbooks)
4. [Decision Trees](#decision-trees)
5. [Error Recovery Procedures](#error-recovery-procedures)

---

## Tool Reference

### Wallet Tools

#### `create_wallet`

Creates a new Solana wallet with AES-256-GCM encrypted key storage.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `label` | string | No | `"agent-wallet"` | Human-readable label |

**Behavior:**

- Generates an Ed25519 keypair
- Encrypts the private key with PBKDF2 (210,000 iterations, SHA-512) + AES-256-GCM
- Attaches the devnet safety policy (2 SOL/tx, 30 tx/hr, 10 SOL/day)
- If a master wallet is configured, auto-funds the new wallet with seed SOL
- Logs `wallet:created` to the audit trail

**Returns:** `wallet_id` (UUID), `publicKey` (base58), `label`, `balance`

**When to use:** At the start of any session when no wallet exists, or when the user asks to create a new wallet for a specific purpose.

**Example:**

```
create_wallet(label: "trading-bot-1")
→ { wallet_id: "abc-123", publicKey: "7xK...", label: "trading-bot-1", balance: 0.05 }
```

---

#### `list_wallets`

Lists all wallets with IDs, labels, public keys, and SOL balances.

**Parameters:** None

**Returns:** Array of wallet objects, or "no wallets" message.

**When to use:** To discover which wallets are available before performing any operation.

---

#### `get_balance`

Returns SOL and all SPL token balances for a wallet.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `wallet_id` | string | Yes | Wallet UUID |

**Returns:** SOL balance (in SOL and lamports), plus array of SPL token balances with mint, amount, decimals, and UI amount.

**When to use:** Before any transfer or swap to verify sufficient funds. After any transaction to verify it landed.

---

#### `get_policy`

Returns the policy rules and current transaction statistics for a wallet.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `wallet_id` | string | Yes | Wallet UUID |

**Returns:** Policy rules (spend caps, rate limits, allowed programs) and current stats (tx count this hour, daily spend so far).

**When to use:** Before large transactions to check if they'll be allowed. When a transaction is rejected to understand why.

---

#### `get_status`

System-wide overview: cluster, RPC URL, wallet count, balances, recent activity.

**Parameters:** None

**When to use:** At session start to understand the current system state. When the user asks "how is the system doing."

---

#### `get_audit_logs`

Reads the immutable audit trail.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `count` | number | No | 20 | Entries to retrieve (1–100) |
| `wallet_id` | string | No | — | Filter to specific wallet |

**When to use:** To investigate what happened, verify past transactions, or generate reports.

---

### Transfer Tools

#### `send_sol`

Transfers SOL from a managed wallet to any Solana address.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `wallet_id` | string | Yes | Source wallet UUID |
| `to` | string | Yes | Recipient base58 public key |
| `amount` | number | Yes | SOL amount (positive) |

**Behavior:**

1. Validates the recipient as a valid base58 public key
2. Checks the wallet's policy (spend cap, rate limit, cooldown)
3. Builds a SystemProgram.transfer instruction
4. Signs with the wallet's decrypted keypair
5. Sends via Kora (gasless) if configured, otherwise standard RPC
6. Logs `sol:transfer` to audit trail

**Returns:** Transaction signature, explorer URL, gasless flag.

**Pre-checks you must do:**

1. `get_balance` — verify the wallet has enough SOL (amount + ~0.000005 for fees)
2. `get_policy` — verify the amount is within per-tx limit

---

#### `send_token`

Transfers SPL tokens. Auto-creates the recipient's Associated Token Account if needed.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `wallet_id` | string | Yes | — | Source wallet UUID |
| `to` | string | Yes | — | Recipient base58 public key |
| `mint` | string | Yes | — | Token mint address (base58) |
| `amount` | number | Yes | — | Token amount (human-readable, e.g., 10.5) |
| `decimals` | number | No | 6 | Token decimals (6 for USDC, 9 for SOL-wrapped) |

**Pre-checks:** Same as `send_sol`, plus verify the wallet actually holds the token via `get_balance`.

---

#### `write_memo`

Writes a text memo on-chain via the SPL Memo Program. Optionally attaches a SOL transfer.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `wallet_id` | string | Yes | — | Signing wallet UUID |
| `message` | string | Yes | — | Memo text (1–500 chars) |
| `transfer_to` | string | No | — | Recipient for optional SOL transfer |
| `transfer_amount` | number | No | — | SOL to send alongside memo |

**When to use:** On-chain audit trails, agent decision logging, protocol interactions, or tagging transactions with context.

---

### Token Tools

#### `create_token_mint`

Creates a new SPL token mint. The wallet becomes the mint authority.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `wallet_id` | string | Yes | — | Paying wallet (becomes mint authority) |
| `decimals` | number | No | 9 | Token decimals (9 = SOL-like, 6 = USDC-like) |

**Returns:** Mint address, decimals, authority public key.

**Follow-up:** Use `mint_tokens` to create initial supply.

---

#### `mint_tokens`

Mints tokens to any wallet. The signing wallet must be the mint authority.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `wallet_id` | string | Yes | — | Mint authority wallet UUID |
| `mint` | string | Yes | — | Token mint address |
| `amount` | number | Yes | — | Tokens to mint (human-readable) |
| `to` | string | No | self | Recipient (defaults to signing wallet) |

---

#### `swap_tokens`

Jupiter DEX swap — best route across all Solana liquidity sources.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `wallet_id` | string | Yes | — | Source wallet UUID |
| `input_token` | string | Yes | — | Symbol (SOL, USDC, USDT, BONK, JUP) or mint address |
| `output_token` | string | Yes | — | Symbol or mint address |
| `amount` | number | Yes | — | Input token amount (human-readable) |
| `slippage_bps` | number | No | 50 | Slippage tolerance (50 = 0.5%, max 300) |

**Behavior:**

1. Resolves token symbols to mint addresses
2. Validates input ≠ output
3. Fetches Jupiter quote (best route across all DEXs)
4. Builds swap transaction (versioned transaction)
5. Signs and sends (policy-checked)
6. Returns route info, price impact, minimum received

**Pre-checks:**

1. `get_balance` — verify you hold enough of the input token
2. `fetch_prices` — understand current market rates before swapping

**Important:** When input is SOL, the lamport amount is checked against policy spend caps. For non-SOL inputs, spend caps don't apply (but rate limits still do).

---

### Payment Tools

#### `probe_x402`

Checks if a URL requires x402 payment. No funds spent.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | string | Yes | URL to probe |

**Returns:** `requiresPayment` boolean, payment options (price, token, network), x402 version.

**Always call this before `pay_x402`.**

---

#### `pay_x402`

Pays for and retrieves an x402-protected HTTP resource.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `wallet_id` | string | Yes | — | Paying wallet UUID |
| `url` | string | Yes | — | x402-protected URL |
| `method` | string | No | GET | HTTP method (GET, POST, PUT, DELETE) |
| `headers` | object | No | — | HTTP headers |
| `body` | string | No | — | Request body |

**Behavior:**

1. Makes HTTP request to URL
2. If 402 response: parses payment header, builds Solana payment tx, signs, retries with payment signature
3. Returns resource content on success

**Pre-checks:**

1. `probe_x402` — discover the price
2. `get_balance` — confirm funds cover it

---

### Trading Tools

#### `fetch_prices`

Fetches real-time USD prices from Jupiter Price API v2.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tokens` | string | Yes | Comma-separated symbols or mints (e.g., `"SOL,USDC,BONK"`) |

**Known symbols:** SOL, USDC, USDT, BONK, JUP. Any string >20 chars is treated as a mint address.

**Returns:** Timestamped array of `{ symbol, mint, priceUsd }`.

---

#### `evaluate_strategy`

Evaluates a trading strategy and returns a BUY/SELL/HOLD signal.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `strategy` | string | Yes | — | `"threshold-rebalance"` or `"sma-crossover"` |
| `wallet_id` | string | Yes | — | Wallet UUID (used to track SMA state) |
| `sol_price_usd` | number | Yes | — | Current SOL price (from `fetch_prices`) |
| `sol_balance` | number | Yes | — | Current SOL balance (from `get_balance`) |
| `usdc_balance` | number | Yes | — | Current USDC balance (from `get_balance`) |
| `target_allocation` | number | No | 0.7 | Target SOL allocation (threshold-rebalance only) |
| `drift_threshold` | number | No | 0.05 | Drift before rebalance (threshold-rebalance only) |
| `fast_window` | number | No | 5 | Fast SMA window (sma-crossover only) |
| `slow_window` | number | No | 20 | Slow SMA window (sma-crossover only) |
| `trade_fraction` | number | No | 0.2 | Fraction to trade per signal (sma-crossover only) |

**Strategies:**

- **threshold-rebalance:** Compares current SOL allocation vs. target. Signals BUY/SELL if drift exceeds threshold.
- **sma-crossover:** Accumulates price history across calls. Needs `slow_window` ticks before generating signals. Golden cross = BUY, death cross = SELL.

**Important:** `sma-crossover` is stateful — each call adds to the price history for that wallet. Early calls will return HOLD until enough data accumulates.

**Returns:** Signal (BUY/SELL/HOLD), reasoning, context, strategy parameters, and a `nextStep` field with the exact `swap_tokens` call to execute.

---

## Executable Scripts

These scripts can be run directly by agents with shell access (Claude Code, Cursor, terminal-enabled agents). They work independently of the MCP server — useful for quick checks, devnet setup, and debugging.

All scripts output JSON. All are **read-only** except `airdrop.sh` (which requests devnet SOL).

---

### `airdrop.sh` — Devnet SOL Airdrop

Request free devnet SOL for any Solana wallet address. Use when a wallet has zero balance and needs funding for testing.

| Property      | Value                                                                    |
| ------------- | ------------------------------------------------------------------------ |
| **Script**    | `bash {baseDir}/skills/scripts/airdrop.sh <wallet_address> [amount_sol]` |
| **Read-only** | No — requests an airdrop (devnet only, free)                             |
| **Requires**  | `curl`, `bc`, network access to Solana devnet RPC                        |

**How to use:**

1. Get the wallet's public key (base58, 32-44 characters)
2. Run: `bash {baseDir}/skills/scripts/airdrop.sh <wallet_address> 1`
3. Parse the JSON response

**Reading the response:**

```json
{
  "success": true,
  "signature": "5vGk...",
  "amountSol": 1,
  "newBalanceSol": 1.05,
  "wallet": "7xK...",
  "explorer": "https://explorer.solana.com/tx/5vGk...?cluster=devnet"
}
```

- `success` — `true` if the airdrop landed
- `signature` — transaction signature (verify on explorer)
- `newBalanceSol` — balance after airdrop
- Max 2 SOL per request on devnet. If rate-limited, wait 30 seconds and retry.

**Triggers:** "fund wallet", "airdrop SOL", "get devnet SOL", "wallet has no balance", "need SOL for testing"

**Rules:**

- Only works on devnet. Never attempt on mainnet.
- Default amount is 1 SOL if not specified.
- If the faucet is rate-limited, inform the user to wait — do not retry in a loop.

---

### `check-balance.sh` — Quick Balance Check

Query any Solana wallet's SOL balance directly via RPC. No MCP server needed.

| Property      | Value                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| **Script**    | `bash {baseDir}/skills/scripts/check-balance.sh <wallet_address> [rpc_url]` |
| **Read-only** | Yes                                                                         |
| **Requires**  | `curl`, `bc`, network access to Solana RPC                                  |

**How to use:**

1. Get the Solana public key
2. Run: `bash {baseDir}/skills/scripts/check-balance.sh <wallet_address>`
3. Parse the JSON response

**Reading the response:**

```json
{
  "wallet": "7xK...",
  "balanceLamports": 1500000000,
  "balanceSol": 1.5,
  "tokenAccounts": 3,
  "rpcUrl": "https://api.devnet.solana.com"
}
```

- `balanceSol` — SOL balance with full precision (do not round)
- `tokenAccounts` — number of SPL token accounts (not the token balances themselves)
- Defaults to devnet RPC. Pass a custom URL as second argument for other clusters.

**Triggers:** "check balance", "how much SOL", "wallet balance", "quick balance check", any Solana address pasted by user

**Rules:**

- This is read-only. No transactions. No keys needed.
- Only accepts Solana public keys (base58, 32-44 chars).
- For detailed token balances, use the MCP `get_balance` tool instead.

---

### `audit-summary.sh` — Audit Log Summary

Parse the local audit log files and produce a summarized JSON report for a given day.

| Property      | Value                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| **Script**    | `bash {baseDir}/skills/scripts/audit-summary.sh [YYYY-MM-DD] [wallet_id]` |
| **Read-only** | Yes                                                                       |
| **Requires**  | Local filesystem access to `~/.agent-economy-wallet/logs/`                      |

**How to use:**

1. Run: `bash {baseDir}/skills/scripts/audit-summary.sh` (defaults to today)
2. Optionally filter by date and/or wallet: `bash {baseDir}/skills/scripts/audit-summary.sh 2025-01-15 abc-123`
3. Parse the JSON response

**Reading the response:**

```json
{
  "date": "2025-01-15",
  "totalEntries": 47,
  "successes": 42,
  "failures": 5,
  "uniqueWallets": 3,
  "firstEntry": "2025-01-15T08:30:00.000Z",
  "lastEntry": "2025-01-15T22:15:00.000Z",
  "actions": {
    "walletCreated": 1,
    "solTransfers": 15,
    "tokenTransfers": 8,
    "swaps": 10,
    "memos": 3,
    "mints": 2,
    "policyViolations": 5,
    "x402Payments": 3,
    "walletsClosed": 0
  },
  "walletFilter": null,
  "logFile": "/home/user/.agent-economy-wallet/logs/audit-2025-01-15.jsonl"
}
```

- `policyViolations` > 0 means the agent hit safety limits — review and adapt
- `failures` includes policy violations + RPC errors + any other failures
- If no log exists for the given date, available dates are listed in the error

**Triggers:** "audit summary", "daily report", "what happened today", "review activity", "check for failures", "policy violations"

**Rules:**

- Read-only. Only reads local JSONL files.
- Requires the agent economy wallet to have been used (logs directory must exist).
- If asked for "yesterday" or "last week", compute the date and pass it as argument.

---

### `tx-lookup.sh` — Transaction Lookup

Fetch details for a Solana transaction by its signature.

| Property      | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| **Script**    | `bash {baseDir}/skills/scripts/tx-lookup.sh <signature> [rpc_url]` |
| **Read-only** | Yes                                                                |
| **Requires**  | `curl`, `bc`, network access to Solana RPC                         |

**How to use:**

1. Get the transaction signature (base58 string from a previous tool result or audit log)
2. Run: `bash {baseDir}/skills/scripts/tx-lookup.sh <signature>`
3. Parse the JSON response

**Reading the response:**

```json
{
  "signature": "5vGk...",
  "status": "success",
  "slot": 123456789,
  "timestamp": "2025-01-15T10:30:00Z",
  "feeLamports": 5000,
  "feeSol": 0.000005,
  "signers": "7xK...",
  "instructionCount": 2,
  "explorer": "https://explorer.solana.com/tx/5vGk...?cluster=devnet"
}
```

- `status` — `"success"` or `"failed"`
- `feeSol` — network fee paid (0 if gasless via Kora was used and the fee payer is different)
- `explorer` — direct link to Solana Explorer

**Triggers:** "look up transaction", "check tx status", "did the transaction go through", "verify transfer", any transaction signature pasted by user

**Rules:**

- Read-only. No keys needed.
- If the transaction is not found, it may not be confirmed yet — suggest waiting a few seconds and retrying.
- Defaults to devnet. Pass a custom RPC URL for other clusters.

---

### `health-check.sh` — Wallet Health Check

Scan all local agent economy wallets, fetch live balances, and flag issues (low balance, missing policies).

| Property      | Value                                                                 |
| ------------- | --------------------------------------------------------------------- |
| **Script**    | `bash {baseDir}/skills/scripts/health-check.sh [rpc_url]`             |
| **Read-only** | Yes                                                                   |
| **Requires**  | `curl`, `bc`, `find`, local filesystem access to `~/.agent-economy-wallet/` |

**How to use:**

1. Run: `bash {baseDir}/skills/scripts/health-check.sh`
2. Parse the JSON response

**Reading the response:**

```json
{
  "walletCount": 3,
  "totalBalanceSol": 4.55,
  "totalBalanceLamports": 4550000000,
  "policyStateExists": true,
  "todayAuditEntries": 12,
  "todayFailures": 1,
  "rpcUrl": "https://api.devnet.solana.com",
  "wallets": [
    {
      "id": "abc-123",
      "label": "trading-bot",
      "publicKey": "7xK...",
      "balanceSol": 2.55,
      "balanceLamports": 2550000000,
      "warning": null
    },
    {
      "id": "def-456",
      "label": "payment-agent",
      "publicKey": "Bx9...",
      "balanceSol": 0.005,
      "balanceLamports": 5000000,
      "warning": "low-balance: < 0.01 SOL"
    }
  ]
}
```

- `warning` — `"low-balance: < 0.01 SOL"` if a wallet is nearly empty, `null` otherwise
- `policyStateExists` — `false` means the policy engine hasn't been initialized (unusual)
- `todayFailures` > 0 — recommend running `audit-summary.sh` for details

**Formatting the response:**

- If all wallets are healthy: "All N wallets are healthy. Total balance: X SOL."
- If any have warnings: list them with their labels and suggest funding
- If `todayFailures` > 0: mention it and suggest reviewing audit logs

**Triggers:** "health check", "are my wallets ok", "wallet status", "system check", "show all wallets", "any issues"

**Rules:**

- Read-only. Does not modify wallets or execute transactions.
- Reads keystore files for IDs/labels/public keys only — never decrypts private keys.
- If no wallets exist, tell the user to create one first.

---

## Workflow Playbooks

### Playbook 1: First-Time Setup

```
Goal: Create a wallet, verify it's funded, understand its limits.

Step 1: get_status()
        → Check system state, see if any wallets exist

Step 2: create_wallet(label: "primary-agent")
        → Get wallet_id and public key

Step 3: get_balance(wallet_id)
        → Confirm SOL balance (auto-funded if master wallet configured)
        → If balance is 0 and on devnet: tell user to airdrop SOL to the public key

Step 4: get_policy(wallet_id)
        → Understand: max 2 SOL/tx, 30 tx/hr, 10 SOL/day
```

### Playbook 2: Safe SOL Transfer

```
Goal: Send SOL to another address without surprises.

Step 1: get_balance(wallet_id)
        → Available = balance - 0.001 (reserve for fees)
        → If available < requested amount: STOP, tell user

Step 2: get_policy(wallet_id)
        → Check: amount ≤ maxLamportsPerTx / 1e9
        → Check: hourly tx count < maxTxPerHour
        → If either would fail: STOP, explain the limit

Step 3: send_sol(wallet_id, to, amount)
        → Record the signature

Step 4: get_balance(wallet_id)
        → Verify balance decreased by approximately (amount + fee)
        → Report final balance to user
```

### Playbook 3: Token Creation and Distribution

```
Goal: Create a custom token and mint initial supply.

Step 1: get_balance(wallet_id)
        → Need ~0.003 SOL for mint creation + ATA

Step 2: create_token_mint(wallet_id, decimals: 9)
        → Save the mint address

Step 3: mint_tokens(wallet_id, mint, amount: 1000000)
        → Mints to the wallet itself

Step 4: get_balance(wallet_id)
        → Verify SOL decreased slightly, token balance shows 1,000,000

Step 5: (Optional) mint_tokens(wallet_id, mint, amount: 50000, to: "other-address")
        → Distribute to another wallet
```

### Playbook 4: Jupiter Swap

```
Goal: Swap SOL for USDC at best available rate.

Step 1: fetch_prices(tokens: "SOL,USDC")
        → Know the current exchange rate

Step 2: get_balance(wallet_id)
        → Check SOL balance, check existing USDC balance

Step 3: swap_tokens(wallet_id, "SOL", "USDC", 0.5, slippage_bps: 50)
        → Jupiter finds best route, executes swap
        → Review: route taken, price impact, amount received

Step 4: get_balance(wallet_id)
        → Verify SOL decreased, USDC increased
```

### Playbook 5: Autonomous Trading (Multi-Tick)

```
Goal: Run a recurring trading strategy.

Setup:
  create_wallet(label: "trading-bot")
  → Ensure wallet has both SOL and USDC

Each Tick:
  Step 1: fetch_prices(tokens: "SOL,USDC")
          → Get sol_price_usd

  Step 2: get_balance(wallet_id)
          → Get sol_balance, usdc_balance

  Step 3: evaluate_strategy(
            strategy: "threshold-rebalance",  // or "sma-crossover"
            wallet_id, sol_price_usd, sol_balance, usdc_balance
          )
          → Get signal: BUY, SELL, or HOLD

  Step 4: If signal is BUY or SELL:
            Read the nextStep field from the response
            Execute: swap_tokens(...) with the suggested parameters

  Step 5: get_balance(wallet_id)
          → Verify trade executed correctly

  Step 6: get_audit_logs(count: 5, wallet_id)
          → Confirm audit trail is clean

  Step 7: Wait (respect rate limits: ≤30 tx/hr)
          → Repeat from Step 1

Note for sma-crossover: first ~20 ticks will return HOLD until enough price
history accumulates. This is normal.
```

### Playbook 6: x402 Payment

```
Goal: Access paid API content using an agent wallet.

Step 1: probe_x402(url: "https://api.example.com/data")
        → Check if payment required, discover price

Step 2: If requiresPayment = false:
          → URL is free, just fetch it normally (not through this system)

Step 3: get_balance(wallet_id)
        → Verify balance covers the payment amount

Step 4: pay_x402(wallet_id, url: "https://api.example.com/data")
        → Automatically handles 402 → payment → retry flow
        → Returns the resource content

Step 5: get_audit_logs(count: 3, wallet_id)
        → Verify payment was logged (x402:payment_success)
```

---

## Decision Trees

### "Which tool do I use for sending value?"

```
Is it SOL?
  → send_sol

Is it an SPL token I hold?
  → send_token (need: mint address, decimals)

Is it a swap between tokens?
  → swap_tokens (Jupiter handles routing)

Is it a payment for an x402 API?
  → pay_x402
```

### "A transaction failed — what do I do?"

```
Error mentions "policy" or "exceeds"?
  → get_policy(wallet_id)
  → Check which limit was hit (per-tx, hourly, daily)
  → Wait or use a smaller amount

Error mentions "insufficient" or "balance"?
  → get_balance(wallet_id)
  → Need more SOL: tell the user to fund it

Error mentions "rate" or "cooldown"?
  → Wait at least the cooldown period (default: 2 seconds)
  → Check hourly count via get_policy

Error mentions "program" or "allowlist"?
  → The wallet's policy blocks this program
  → Use a different wallet or ask the human operator

Other error?
  → get_audit_logs(count: 5, wallet_id)
  → Read the error details in the audit entry
  → Report to the user with full context
```

### "Should I create a new wallet or use an existing one?"

```
Does user mention a specific wallet? → Use that one
Does user say "new wallet" or "fresh wallet"? → create_wallet
Are there existing wallets (list_wallets)? → Ask user which one
No wallets exist? → create_wallet
Different purpose (trading vs. holding)? → create_wallet with descriptive label
```

---

## Error Recovery Procedures

### Rate Limit Hit

1. Call `get_policy(wallet_id)` to see current tx counts
2. Calculate: `10 - currentHourlyCount` = remaining txs this hour
3. If 0 remaining: wait until the oldest tx in the hour window expires
4. Inform the user: "Rate limit reached. N transactions remain this hour."

### Insufficient Balance

1. Call `get_balance(wallet_id)` to get exact balance
2. Calculate shortfall: `needed - available`
3. Inform user: "Need X more SOL. Current balance: Y SOL."
4. If on devnet: suggest `solana airdrop` to the wallet's public key

### Policy Violation (Spend Cap)

1. Call `get_policy(wallet_id)` to see the max per-tx limit
2. Split into multiple smaller transactions if possible
3. Inform user of the limit and suggest splitting

### Transaction Simulation Failure

1. Read the error message carefully
2. Check `get_balance` for token-specific balances
3. Verify addresses are valid base58 public keys
4. Check `get_audit_logs` for recent failures with similar patterns
5. Report the full error to the user
