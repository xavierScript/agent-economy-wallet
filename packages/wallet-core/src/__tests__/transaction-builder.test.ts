import { describe, it, expect } from "vitest";
import { TransactionBuilder } from "../transaction-builder.js";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { SolanaConnection } from "../connection.js";

describe("TransactionBuilder", () => {
  const connection = new SolanaConnection(
    "https://api.devnet.solana.com",
    "devnet",
  );
  const txBuilder = new TransactionBuilder(connection);

  describe("buildSolTransfer", () => {
    it("should create a valid SOL transfer transaction", () => {
      const from = Keypair.generate().publicKey;
      const to = Keypair.generate().publicKey;
      const tx = txBuilder.buildSolTransfer(from, to, 1.5);

      expect(tx.instructions).toHaveLength(1);
      const ix = tx.instructions[0];
      expect(ix.programId.equals(SystemProgram.programId)).toBe(true);
    });

    it("should correctly convert SOL amount to lamports", () => {
      const from = Keypair.generate().publicKey;
      const to = Keypair.generate().publicKey;
      const tx = txBuilder.buildSolTransfer(from, to, 2.0);

      const ix = tx.instructions[0];
      // Decode the transfer amount from instruction data
      // SystemProgram transfer: 4 bytes instruction index + 8 bytes amount
      const amount = ix.data.readBigUInt64LE(4);
      expect(Number(amount)).toBe(2_000_000_000); // 2 SOL in lamports
    });

    it("should handle fractional SOL amounts", () => {
      const from = Keypair.generate().publicKey;
      const to = Keypair.generate().publicKey;
      const tx = txBuilder.buildSolTransfer(from, to, 0.001);

      const ix = tx.instructions[0];
      const amount = ix.data.readBigUInt64LE(4);
      expect(Number(amount)).toBe(1_000_000); // 0.001 SOL = 1M lamports
    });
  });

  describe("buildComputeBudgetInstructions", () => {
    it("should return two instructions (units + price)", () => {
      const ixs = txBuilder.buildComputeBudgetInstructions(200_000, 1000);
      expect(ixs).toHaveLength(2);
    });

    it("should target the ComputeBudget program", () => {
      const ixs = txBuilder.buildComputeBudgetInstructions();
      const COMPUTE_BUDGET = new PublicKey(
        "ComputeBudget111111111111111111111111111111",
      );
      expect(ixs[0].programId.equals(COMPUTE_BUDGET)).toBe(true);
      expect(ixs[1].programId.equals(COMPUTE_BUDGET)).toBe(true);
    });
  });
});
