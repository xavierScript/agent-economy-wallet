import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { OnchainProgram } from "../target/types/onchain_program";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";

describe("agent-reputation", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.onchainProgram as Program<OnchainProgram>;

  // Create a mock merchant keypair
  const merchant = Keypair.generate();

  // Derive the merchant reputation PDA
  const [merchantPda, merchantBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("merchant"), merchant.publicKey.toBuffer()],
    program.programId,
  );

  it("initializes a merchant reputation account", async () => {
    const tx = await program.methods
      .initializeMerchant()
      .accounts({
        merchantAccount: merchantPda,
        merchant: merchant.publicKey,
        payer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("  Initialize tx:", tx);

    // Fetch the account and verify
    const account = await program.account.merchantAccount.fetch(merchantPda);
    expect(account.merchant.toBase58()).to.equal(
      merchant.publicKey.toBase58(),
    );
    expect(account.totalPayments.toNumber()).to.equal(0);
    expect(account.totalVolumeLamports.toNumber()).to.equal(0);
    expect(account.uniqueBuyers).to.equal(0);
    expect(account.lastPaymentTs.toNumber()).to.equal(0);
    expect(account.bump).to.equal(merchantBump);
  });

  it("records a payment and updates stats", async () => {
    const paymentAmount = new anchor.BN(1_000_000); // 1 USDC (6 decimals)

    const tx = await program.methods
      .recordPayment(paymentAmount)
      .accounts({
        merchantAccount: merchantPda,
        merchant: merchant.publicKey,
        buyer: provider.wallet.publicKey,
      })
      .rpc();

    console.log("  Record payment tx:", tx);

    const account = await program.account.merchantAccount.fetch(merchantPda);
    expect(account.totalPayments.toNumber()).to.equal(1);
    expect(account.totalVolumeLamports.toNumber()).to.equal(1_000_000);
    // First payment → unique_buyers should be 1 (since 1 % 5 == 1)
    expect(account.uniqueBuyers).to.equal(1);
    // Timestamp should be recent
    expect(account.lastPaymentTs.toNumber()).to.be.greaterThan(0);
  });

  it("accumulates multiple payments correctly", async () => {
    // Record 4 more payments (total 5)
    for (let i = 0; i < 4; i++) {
      await program.methods
        .recordPayment(new anchor.BN(500_000)) // 0.5 USDC each
        .accounts({
          merchantAccount: merchantPda,
          merchant: merchant.publicKey,
          buyer: provider.wallet.publicKey,
        })
        .rpc();
    }

    const account = await program.account.merchantAccount.fetch(merchantPda);
    expect(account.totalPayments.toNumber()).to.equal(5);
    // 1_000_000 + (4 * 500_000) = 3_000_000
    expect(account.totalVolumeLamports.toNumber()).to.equal(3_000_000);
    // unique_buyers: incremented at payment 1 (1%5==1) only → still 1
    expect(account.uniqueBuyers).to.equal(1);
  });

  it("increments unique buyers at payment 6 (6 % 5 == 1)", async () => {
    await program.methods
      .recordPayment(new anchor.BN(100_000))
      .accounts({
        merchantAccount: merchantPda,
        merchant: merchant.publicKey,
        buyer: provider.wallet.publicKey,
      })
      .rpc();

    const account = await program.account.merchantAccount.fetch(merchantPda);
    expect(account.totalPayments.toNumber()).to.equal(6);
    expect(account.uniqueBuyers).to.equal(2); // incremented at payment 6
  });

  it("reads reputation via get_reputation instruction", async () => {
    const tx = await program.methods
      .getReputation()
      .accounts({
        merchantAccount: merchantPda,
        merchant: merchant.publicKey,
      })
      .rpc();

    console.log("  Get reputation tx:", tx);
    // This is a read-only convenience — no state changes
    const account = await program.account.merchantAccount.fetch(merchantPda);
    expect(account.totalPayments.toNumber()).to.equal(6);
  });

  it("prevents double initialization (same merchant)", async () => {
    try {
      await program.methods
        .initializeMerchant()
        .accounts({
          merchantAccount: merchantPda,
          merchant: merchant.publicKey,
          payer: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Should not reach here
      expect.fail("Should have thrown on double init");
    } catch (err: any) {
      // Anchor returns an error when trying to init an existing PDA
      expect(err.toString()).to.include("already in use");
    }
  });

  it("works with a second merchant independently", async () => {
    const merchant2 = Keypair.generate();
    const [pda2] = PublicKey.findProgramAddressSync(
      [Buffer.from("merchant"), merchant2.publicKey.toBuffer()],
      program.programId,
    );

    // Initialize
    await program.methods
      .initializeMerchant()
      .accounts({
        merchantAccount: pda2,
        merchant: merchant2.publicKey,
        payer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Record a payment
    await program.methods
      .recordPayment(new anchor.BN(2_000_000))
      .accounts({
        merchantAccount: pda2,
        merchant: merchant2.publicKey,
        buyer: provider.wallet.publicKey,
      })
      .rpc();

    // Verify merchant2's stats are independent
    const account2 = await program.account.merchantAccount.fetch(pda2);
    expect(account2.totalPayments.toNumber()).to.equal(1);
    expect(account2.totalVolumeLamports.toNumber()).to.equal(2_000_000);

    // Verify merchant1 is unaffected
    const account1 = await program.account.merchantAccount.fetch(merchantPda);
    expect(account1.totalPayments.toNumber()).to.equal(6);
  });
});
