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
    const homeEnv = path.join(os.homedir(), ".agent_economy_wallet", ".env");
    if (fs.existsSync(homeEnv)) dotenv.config({ path: homeEnv });
  }

  const publicKeyString = process.env.AGENT_ECONOMY_PUBLIC_KEY;
  if (!publicKeyString) {
    console.error("AGENT_ECONOMY_PUBLIC_KEY not found in .env");
    process.exit(1);
  }

  // Parse args
  let limit = 10;
  const limitIndex = process.argv.indexOf("--limit");
  if (limitIndex > -1 && process.argv.length > limitIndex + 1) {
    limit = parseInt(process.argv[limitIndex + 1], 10) || 10;
  }

  const network =
    process.env.SOLANA_CLUSTER || process.env.AGENT_ECONOMY_NETWORK || "devnet";
  const rpcUrl =
    process.env.SOLANA_RPC_URL || `https://api.${network}.solana.com`;
  const connection = new Connection(rpcUrl, "confirmed");

  try {
    const pubKey = new PublicKey(publicKeyString);
    const signatures = await connection.getSignaturesForAddress(pubKey, {
      limit,
    });

    // We just map the basic signature history since fetching
    // full parsed txs for every signature makes it very slow.
    const transactions = signatures.map((sig) => ({
      signature: sig.signature,
      blockTime: sig.blockTime
        ? new Date(sig.blockTime * 1000).toISOString()
        : null,
      err: sig.err,
      explorer: `https://explorer.solana.com/tx/${sig.signature}?cluster=${network}`,
    }));

    const result = {
      address: publicKeyString,
      count: transactions.length,
      transactions: transactions,
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error("Failed to fetch history:", error.message);
    process.exit(1);
  }
}

main();
