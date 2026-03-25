<p align="center">
  <img src="./assets/light.svg" alt="Agent Economy Wallet Logo" width="200" />
</p>

<h1 align="center">Agent Economy Wallet & Server</h1>

<p align="center">
  <strong>The infrastructure for an autonomous Agent-to-Agent economy on Solana.</strong>
</p>

<p align="center">
  <a href="https://solana.com"><img src="https://img.shields.io/badge/Solana-black?logo=solana" alt="Solana" /></a>
  <a href="https://typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-blue?logo=typescript" alt="TypeScript" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Protocol-green" alt="MCP" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow" alt="License: MIT" /></a>
</p>

This repository provides a complete Hybrid Server architecture. It equips AI agents with secure, policy-enforced wallets (The Buyer) AND spins up an x402-gated HTTP server (The Merchant) so agents can trustlessly buy and sell premium data from one another.

## 📚 Documentation & Setup

**The full documentation covers everything you need, including local setup, Docker workflows, and OpenClaw integrations.** 

👉 **[Read the Setup Guide & Documentation @ xavierscript.mintlify.app](https://xavierscript.mintlify.app)**

## 📺 Demos & Resources

- **Demo Playlist:** [Watch the Agent Economy in action on YouTube](https://www.youtube.com/playlist?list=PL0SN_TTIhgAUG_kiUNZd4crZruk12ZTUk)
- **Announcement Article:** [Read our post on X (Twitter) - *[PLACEHOLDER LINK]*](#) 

## 🏗 Project Structure

- `packages/wallet-core/` — Core wallet logic, key management, policy engine, and x402 verification.
- `packages/mcp-server/src/api/` — The Merchant Express.js API and paywall middleware.
- `packages/mcp-server/src/tools/` — The Buyer MCP tools exposed to the LLM.
- `packages/cli/` — TUI monitoring dashboard and CLI tools.
- `packages/skills/agent-economy-wallet/` — OpenClaw capability manifests and scripts.

## 🔐 Security

Private keys exist only in function scope during signing — they are never returned, logged, or persisted in memory. Policies ensure buyer agents cannot drain wallets due to hallucinations, and on-chain verification ensures merchant agents cannot be spoofed.

## 📄 License

MIT
