# Agent Economy Wallet SDK

The official SDK for integrating the **Agent Economy Wallet**. Programmatically create wallets, sign transactions, interface with X402 devnet payments, and register/discover merchants on the Solana network.

## Table of Contents

- [Installation](#installation)
- [Developer Walkthrough](#developer-walkthrough)
  - [1. Initializing the Wallet](#1-initializing-the-wallet)
  - [2. Merchant: Creating an X402 Paywall](#2-merchant-creating-an-x402-paywall)
  - [3. Merchant: Registering on the Network](#3-merchant-registering-on-the-network)
  - [4. Buyer: Discovering Agents & Paying](#4-buyer-discovering-agents--paying)
- [Publishing to NPM](#publishing-to-npm)

---

## Installation

```bash
npm install agent-economy-wallet
# or using pnpm
pnpm add agent-economy-wallet
# or using yarn
yarn add agent-economy-wallet
```

---

## Developer Walkthrough

This SDK is built for three personas: **Merchants** (selling APIs for crypto), **Buyers** (AI agents buying APIs), and **Hybrids** (both).

### 1. Initializing the Wallet

You can spin up an `AgentWallet` with a managed local keystore or inject your own Keypair.

```typescript
import { AgentWallet } from "agent-economy-wallet";

// Creates an AgentWallet using devnet config by default
const wallet = new AgentWallet({
  cluster: "devnet",
  keystorePath: "./my-keys",
});

async function main() {
  const info = await wallet.initialize();
  console.log(`Wallet initialized: ${info.address}`);
  console.log(`Solana balance: ${info.balances.sol}`);
}

main();
```

### 2. Merchant: Creating an X402 Paywall

If you have an Express.js server, use the SDK's built-in `createX402Paywall` middleware.

```typescript
import express from "express";
import { createCoreServices, createX402Paywall, USDC_MINT } from "agent-economy-wallet";

const app = express();
const services = createCoreServices(); // Inits wallet + X402 Server locally

// Require 0.1 USDC payment for this endpoint
const paywall = createX402Paywall(services, 100_000, USDC_MINT);

app.get("/api/exclusive-data", paywall, (req, res) => {
  res.json({ secret: "Agents rule the world" });
});

app.listen(3000, () => console.log("Merchant API live on 3000"));
```

### 3. Merchant: Registering on the Network

To allow autonomous buyer agents to discover you, register your metadata entirely on-chain.

```typescript
import { buildRegistrationTx } from "agent-economy-wallet";

async function registerSelf(wallet) {
  // 1. Build the transaction putting metadata into an SPL Memo
  const txRecord = await buildRegistrationTx(
    wallet.services.connection.getConnection(),
    wallet.getAddress(),
    "https://my-agent.com/.well-known/agent.json"
  );
  
  // 2. Sign and yield payment for network fee
  const result = await wallet.signAndSendTransaction(txRecord);
  console.log(`Registered! Signature: ${result.signature}`);
}
```

### 4. Buyer: Discovering Agents & Paying

Buyer agents can pull the global registry of available merchants, and use the built-in `X402Client` to pay for gated routes transparently.

```typescript
import { discoverRegistry, X402Client } from "agent-economy-wallet";

async function exploreEconomy(wallet) {
  const conn = wallet.services.connection.getConnection();
  
  // View the first 100 agents registered
  const agents = await discoverRegistry(conn, 100);
  console.log("Found agents:", agents);
  
  // Pay for an API programmatically
  const response = await wallet.services.x402Client.fetchWithPayment(
    "http://other-agent.com/api/exclusive-data",
    { method: "GET" }
  );
  
  const data = await response.json();
  console.log(data);
}
```

---

## Publishing to NPM

This package is designed to be cleanly published independently from the monorepo root.

### Prerequisites

You must be authenticated with npm:
```bash
npm login
```

### Publishing Steps

1. **Build the Entire Workspace**
   Ensure all internal workspace dependencies (`@agent-economy-wallet/core`, etc.) are compiled.
   From the **root** of the monorepo, run:
   ```bash
   pnpm build
   ```

2. **Navigate to the SDK Package**
   ```bash
   cd packages/sdk
   ```

3. **Bump the Version**
   If this is a new release, bump the version in `package.json` (e.g., from `1.0.0` to `1.0.1`):
   ```bash
   npm version patch  # or minor, or major
   ```

4. **Verify the Package Contents**
   Ensure no source files (`.ts`) or internal scripts are accidentally included.
   ```bash
   npm pack --dry-run
   ```
   You should only see `package.json`, `README.md`, and compiled artifacts inside `dist/`.

5. **Publish to Registry**
   Publish the SDK.
   ```bash
   npm publish --access public
   ```

*(Note: If you receive a name conflict error, 'agent-economy-wallet' may already be taken on npmjs.com. In this case, you will need to namespace it, e.g., `@your-org/agent-economy-wallet`.)*
