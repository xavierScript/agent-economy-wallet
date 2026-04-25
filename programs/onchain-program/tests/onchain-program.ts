import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { OnchainProgram } from "../target/types/onchain_program";
import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { expect } from "chai";
import {
  ConnectionMagicRouter,
  GetCommitmentSignature,
} from "@magicblock-labs/ephemeral-rollups-sdk";

// ── Setup ────────────────────────────────────────────────────────────────

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = anchor.workspace.onchainProgram as Program<OnchainProgram>;
const merchant = Keypair.generate();

const STREAM_SESSION_SEED = Buffer.from("stream_session");

function makeSessionId(n: number): number[] {
  const bytes = new Array(16).fill(0);
  bytes[0] = n & 0xff;
  return bytes;
}

// ═══════════════════════════════════════════════════════════════════════
// Reputation Tests
// ═══════════════════════════════════════════════════════════════════════

describe("reputation", () => {
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
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log("  Initialize tx:", tx);

    const account = await program.account.merchantAccount.fetch(merchantPda);
    expect(account.merchant.toBase58()).to.equal(merchant.publicKey.toBase58());
    expect(account.totalPayments.toNumber()).to.equal(0);
    expect(account.totalVolumeLamports.toNumber()).to.equal(0);
    expect(account.bump).to.equal(merchantBump);
  });

  it("records a payment and updates stats", async () => {
    await program.methods
      .recordPayment(new anchor.BN(1_000_000))
      .accounts({
        merchantAccount: merchantPda,
        merchant: merchant.publicKey,
        buyer: provider.wallet.publicKey,
      })
      .rpc();

    const account = await program.account.merchantAccount.fetch(merchantPda);
    expect(account.totalPayments.toNumber()).to.equal(1);
    expect(account.totalVolumeLamports.toNumber()).to.equal(1_000_000);
    expect(account.lastPaymentTs.toNumber()).to.be.greaterThan(0);
  });

  it("reads reputation via get_reputation", async () => {
    const tx = await program.methods
      .getReputation()
      .accounts({
        merchantAccount: merchantPda,
        merchant: merchant.publicKey,
      })
      .rpc();

    console.log("  Get reputation tx:", tx);
    const account = await program.account.merchantAccount.fetch(merchantPda);
    expect(account.totalPayments.toNumber()).to.equal(1);
  });

  it("prevents double initialization", async () => {
    try {
      await program.methods
        .initializeMerchant()
        .accounts({
          merchantAccount: merchantPda,
          merchant: merchant.publicKey,
          payer: provider.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have thrown on double init");
    } catch (err: any) {
      expect(err.toString()).to.include("already in use");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Streaming Sessions — Localnet (no ER needed)
// ═══════════════════════════════════════════════════════════════════════

describe("streaming-sessions (localnet)", () => {
  const sessionIdRaw = makeSessionId(1);
  let sessionPda: PublicKey;
  let sessionBump: number;

  before(() => {
    [sessionPda, sessionBump] = PublicKey.findProgramAddressSync(
      [
        STREAM_SESSION_SEED,
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(sessionIdRaw),
      ],
      program.programId,
    );
    console.log("  Session PDA:", sessionPda.toString());
  });

  it("initializes a stream session", async () => {
    const tx = await program.methods
      .initializeSession(sessionIdRaw, new anchor.BN(1000), new anchor.BN(500))
      .accounts({
        session: sessionPda,
        payer: provider.wallet.publicKey,
        merchant: merchant.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log("  Init session tx:", tx);

    const account = await program.account.streamSession.fetch(sessionPda);
    expect(account.buyer.toBase58()).to.equal(
      provider.wallet.publicKey.toBase58(),
    );
    expect(account.ratePerTick.toNumber()).to.equal(1000);
    expect(account.intervalMs.toNumber()).to.equal(500);
    expect(account.tickCount.toNumber()).to.equal(0);
    expect(account.totalPaid.toNumber()).to.equal(0);
    expect(account.bump).to.equal(sessionBump);
  });

  it("rejects interval < 500ms", async () => {
    const badId = makeSessionId(99);
    const [badPda] = PublicKey.findProgramAddressSync(
      [
        STREAM_SESSION_SEED,
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(badId),
      ],
      program.programId,
    );

    try {
      await program.methods
        .initializeSession(badId, new anchor.BN(1000), new anchor.BN(100))
        .accounts({
          session: badPda,
          payer: provider.wallet.publicKey,
          merchant: merchant.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should have thrown IntervalTooFast");
    } catch (err: any) {
      expect(err.toString()).to.include("IntervalTooFast");
    }
  });

  it("records ticks and accumulates payment", async () => {
    await program.methods
      .recordTick(new anchor.BN(1000))
      .accounts({ session: sessionPda, payer: provider.wallet.publicKey })
      .rpc();

    await program.methods
      .recordTick(new anchor.BN(1000))
      .accounts({ session: sessionPda, payer: provider.wallet.publicKey })
      .rpc();

    const account = await program.account.streamSession.fetch(sessionPda);
    expect(account.tickCount.toNumber()).to.equal(2);
    expect(account.totalPaid.toNumber()).to.equal(2000);
  });

  it("sessions are independent by ID", async () => {
    const id2 = makeSessionId(2);
    const [pda2] = PublicKey.findProgramAddressSync(
      [
        STREAM_SESSION_SEED,
        provider.wallet.publicKey.toBuffer(),
        Buffer.from(id2),
      ],
      program.programId,
    );

    await program.methods
      .initializeSession(id2, new anchor.BN(2000), new anchor.BN(1000))
      .accounts({
        session: pda2,
        payer: provider.wallet.publicKey,
        merchant: merchant.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    const a2 = await program.account.streamSession.fetch(pda2);
    expect(a2.ratePerTick.toNumber()).to.equal(2000);
    expect(a2.tickCount.toNumber()).to.equal(0);

    // Original unaffected
    const a1 = await program.account.streamSession.fetch(sessionPda);
    expect(a1.tickCount.toNumber()).to.equal(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Streaming Sessions — Devnet + MagicBlock ER
// ═══════════════════════════════════════════════════════════════════════

const isLocalnet =
  provider.connection.rpcEndpoint.includes("localhost") ||
  provider.connection.rpcEndpoint.includes("127.0.0.1");

if (isLocalnet) {
  console.log(
    "Skipping ER suite — requires devnet + MagicBlock. Run with: anchor test --provider.cluster devnet --skip-local-validator",
  );
}

const erSuite = isLocalnet ? describe.skip : describe;

erSuite("streaming-sessions-er (devnet + MagicBlock)", () => {
  const connection = new ConnectionMagicRouter(
    process.env.ROUTER_ENDPOINT || "https://devnet-router.magicblock.app/",
    {
      wsEndpoint:
        process.env.ROUTER_ENDPOINT?.replace(/^https:\/\//, "wss://").replace(
          /^http:\/\//,
          "ws://",
        ) || "wss://devnet-router.magicblock.app/",
    },
  );

  const providerMagic = new anchor.AnchorProvider(
    connection,
    anchor.Wallet.local(),
  );

  const sessionIdRaw = makeSessionId(42);
  let sessionPda: PublicKey;
  let ephemeralValidator: any;

  before(async function () {
    this.timeout(30_000);
    [sessionPda] = PublicKey.findProgramAddressSync(
      [
        STREAM_SESSION_SEED,
        providerMagic.wallet.publicKey.toBuffer(),
        Buffer.from(sessionIdRaw),
      ],
      program.programId,
    );
    ephemeralValidator = await connection.getClosestValidator();
    console.log("  ER validator:", JSON.stringify(ephemeralValidator));
    const bal = await connection.getBalance(providerMagic.wallet.publicKey);
    console.log("  Balance:", bal / LAMPORTS_PER_SOL, "SOL");
  });

  it("init session → delegate → tick on ER → close + commit", async function () {
    this.timeout(90_000);

    // 1. Initialize on L1
    let tx = await program.methods
      .initializeSession(sessionIdRaw, new anchor.BN(1000), new anchor.BN(500))
      .accounts({
        session: sessionPda,
        payer: providerMagic.wallet.publicKey,
        merchant: merchant.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .transaction();
    let hash = await sendAndConfirmTransaction(
      connection, tx, [providerMagic.wallet.payer],
      { skipPreflight: true, commitment: "confirmed" },
    );
    console.log("  Init:", hash);

    // 2. Delegate to ER
    tx = await program.methods
      .delegateSession(sessionIdRaw)
      .accounts({
        payer: providerMagic.wallet.publicKey,
        validator: new PublicKey(ephemeralValidator.identity),
        session: sessionPda,
      })
      .transaction();
    hash = await sendAndConfirmTransaction(
      connection, tx, [providerMagic.wallet.payer],
      { skipPreflight: true, commitment: "confirmed" },
    );
    console.log("  Delegate:", hash);

    // 3. Record ticks on ER
    for (let i = 1; i <= 3; i++) {
      tx = await program.methods
        .recordTick(new anchor.BN(1000))
        .accounts({ session: sessionPda, payer: providerMagic.wallet.publicKey })
        .transaction();
      hash = await sendAndConfirmTransaction(
        connection, tx, [providerMagic.wallet.payer],
        { skipPreflight: true },
      );
      console.log(`  Tick #${i}: ${hash}`);
    }

    // 4. Close session (commit + undelegate)
    tx = await program.methods
      .closeSession()
      .accounts({ session: sessionPda, payer: providerMagic.wallet.publicKey })
      .transaction();
    hash = await sendAndConfirmTransaction(
      connection, tx, [providerMagic.wallet.payer],
      { skipPreflight: true },
    );
    console.log("  Close:", hash);

    // 5. Verify on L1
    const commitSig = await GetCommitmentSignature(
      hash,
      new anchor.web3.Connection(ephemeralValidator.fqdn),
    );
    console.log("  L1 commit:", commitSig);

    const account = await program.account.streamSession.fetch(sessionPda);
    expect(account.tickCount.toNumber()).to.equal(3);
    expect(account.totalPaid.toNumber()).to.equal(3000);
    expect(JSON.stringify(account.status)).to.include("closed");
  });
});
