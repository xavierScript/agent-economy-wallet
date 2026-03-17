#!/usr/bin/env node
import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import os from "os";
import dotenv from "dotenv";

async function main() {
  const envFile = path.join(process.cwd(), "../../..", ".env");
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  } else {
    // try the homedir as fallback
    const homeEnv = path.join(os.homedir(), ".agent_economy_wallet", ".env");
    if (fs.existsSync(homeEnv)) {
      dotenv.config({ path: homeEnv });
    }
  }

  const publicKeyString = process.env.AGENT_ECONOMY_PUBLIC_KEY;
  if (!publicKeyString) {
    console.error("AGENT_ECONOMY_PUBLIC_KEY not found in .env");
    process.exit(1);
  }

  const network =
    process.env.SOLANA_CLUSTER || process.env.AGENT_ECONOMY_NETWORK || "devnet";
  const rpcUrl =
    process.env.SOLANA_RPC_URL || `https://api.${network}.solana.com`;
  const connection = new Connection(rpcUrl, "confirmed");

  try {
    const pubKey = new PublicKey(publicKeyString);
    const balance = await connection.getBalance(pubKey);
    const sol = balance / 1e9;

    const result = {
      address: publicKeyString,
      sol: sol,
      network: network,
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error("Failed to fetch balance:", error.message);
    process.exit(1);
  }
}

main();
