import type { Cluster } from "@solana/web3.js";
import { config as loadEnv } from "dotenv";

loadEnv();

export interface AgentWalletConfig {
  /** Solana cluster: devnet | testnet | mainnet-beta */
  cluster: Cluster;
  /** Solana RPC URL override */
  rpcUrl?: string;
  /** Directory to store encrypted keystores */
  keystoreDir: string;
  /** Directory to store audit logs */
  logDir: string;
  /** Passphrase for encrypting/decrypting private keys */
  passphrase: string;
  /** Jupiter API base URL */
  jupiterApiUrl: string;
  /** Logging level */
  logLevel: "debug" | "info" | "warn" | "error";
}

export function getDefaultConfig(): AgentWalletConfig {
  const home = process.env.HOME || process.env.USERPROFILE || ".";
  return {
    cluster: (process.env.SOLANA_CLUSTER as Cluster) || "devnet",
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    keystoreDir: `${home}/.agentic-wallet/keys`,
    logDir: `${home}/.agentic-wallet/logs`,
    passphrase: process.env.WALLET_PASSPHRASE || "default-dev-passphrase",
    jupiterApiUrl: process.env.JUPITER_API_URL || "https://api.jup.ag/swap/v1",
    logLevel:
      (process.env.LOG_LEVEL as AgentWalletConfig["logLevel"]) || "info",
  };
}
