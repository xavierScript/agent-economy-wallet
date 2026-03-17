#!/usr/bin/env node
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
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
    console.error(
      "AGENT_ECONOMY_SECRET_KEY not found in .env. Ensure the wallet is provisioned.",
    );
    process.exit(1);
  }

  const toAddress = process.argv[2];
  const amountStr = process.argv[3];

  if (!toAddress || !amountStr) {
    console.error("Usage: tsx send.ts <to_address> <amount_sol>");
    process.exit(1);
  }

  let toPubkey: PublicKey;
  try {
    toPubkey = new PublicKey(toAddress);
  } catch {
    console.error("Invalid recipient address");
    process.exit(1);
  }

  const amountSol = parseFloat(amountStr);
  if (isNaN(amountSol) || amountSol <= 0) {
    console.error("Amount must be greater than 0");
    process.exit(1);
  }

  const network =
    process.env.SOLANA_CLUSTER || process.env.AGENT_ECONOMY_NETWORK || "devnet";
  const rpcUrl =
    process.env.SOLANA_RPC_URL || `https://api.${network}.solana.com`;
  const connection = new Connection(rpcUrl, "confirmed");

  try {
    const fromSecretKey = bs58.decode(secretKeyString);
    const fromKeypair = Keypair.fromSecretKey(fromSecretKey);
    const lamports = Math.floor(amountSol * 1e9);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPubkey,
        lamports,
      }),
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [
      fromKeypair,
    ]);

    const result = {
      from: fromKeypair.publicKey.toBase58(),
      to: toAddress,
      amountSol: amountSol,
      signature: signature,
      explorer: `https://explorer.solana.com/tx/${signature}?cluster=${network}`,
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    if (error.message.includes("insufficient lamports")) {
      console.error("Insufficient balance");
    } else {
      console.error("Failed to send transaction:", error.message);
    }
    process.exit(1);
  }
}

main();
