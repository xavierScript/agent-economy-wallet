#!/usr/bin/env node
import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { X402Client } from "@agent-economy-wallet/core";
import fs from "fs";
import path from "path";
import os from "os";
import dotenv from "dotenv";
import bs58 from "bs58";

async function main() {
  const envFile = path.join(process.cwd(), "../../..", ".env");
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  } else {
    const homeEnv = path.join(os.homedir(), ".agent_economy_wallet", ".env");
    if (fs.existsSync(homeEnv)) dotenv.config({ path: homeEnv });
  }

  const secretKeyString = process.env.AGENT_ECONOMY_SECRET_KEY;
  if (!secretKeyString) {
    console.error("AGENT_ECONOMY_SECRET_KEY not found in .env");
    process.exit(1);
  }

  const url = process.argv[2];
  if (!url) {
    console.error("Usage: tsx x402-pay.ts <url>");
    process.exit(1);
  }

  const network =
    process.env.SOLANA_CLUSTER || process.env.AGENT_ECONOMY_NETWORK || "devnet";
  const rpcUrl =
    process.env.SOLANA_RPC_URL || `https://api.${network}.solana.com`;
  const connection = new Connection(rpcUrl, "confirmed");

  const fromSecretKey = bs58.decode(secretKeyString);
  const payerKeypair = Keypair.fromSecretKey(fromSecretKey);

  // Initialize the x402 client
  // Solana CAIP-2 chain IDs: Devnet=EtWTRABZaYq6iMfeYKouRu166VU2xqa1, Mainnet=5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
  const chainId =
    network === "devnet"
      ? "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
      : "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

  const client = new X402Client({
    preferredNetwork: chainId,
    autoRetry: true,
    maxPaymentLamports: 1000000000, // Safe default max (1 SOL)
  });

  try {
    const result = await client.payForResource(
      url,
      { method: "GET", headers: { Accept: "application/json" } },
      async (tx: Transaction) => {
        tx.sign(payerKeypair);
        return tx;
      },
      payerKeypair.publicKey.toBase58(),
      connection,
    );

    if (result.success) {
      console.log(
        JSON.stringify(
          {
            status: "success",
            url: url,
            amountPaid: result.amountPaid,
            tokenMint: result.tokenMint,
            settlement: result.settlement,
            body: result.body ? result.body : null,
          },
          null,
          2,
        ),
      );
    } else {
      console.error("Request failed or payment was rejected:", result.error);
      process.exit(1);
    }
  } catch (error: any) {
    console.error("Failed to execute x402 payment:", error.message);
    process.exit(1);
  }
}

main();
