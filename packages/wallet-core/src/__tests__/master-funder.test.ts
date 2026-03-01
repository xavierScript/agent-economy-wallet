import { describe, it, expect, vi, beforeEach } from "vitest";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { MasterFunder } from "../core/master-funder.js";
import { SolanaConnection } from "../core/connection.js";
import { AuditLogger } from "../core/audit-logger.js";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../core/connection.js", () => {
  const SolanaConnection = vi.fn().mockImplementation(() => ({
    getConnection: vi.fn().mockReturnValue({
      getBalance: vi.fn().mockResolvedValue(10 * LAMPORTS_PER_SOL),
      sendRawTransaction: vi.fn().mockResolvedValue("mock-signature-123"),
      confirmTransaction: vi.fn().mockResolvedValue({ value: {} }),
    }),
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N",
      lastValidBlockHeight: 100,
    }),
  }));
  return { SolanaConnection };
});

vi.mock("../core/audit-logger.js", () => {
  const AuditLogger = vi.fn().mockImplementation(() => ({
    log: vi.fn(),
  }));
  return { AuditLogger };
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMasterKeypair(): Keypair {
  return Keypair.generate();
}

function encodedSecret(kp: Keypair): string {
  return bs58.encode(kp.secretKey);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("MasterFunder", () => {
  let connection: SolanaConnection;
  let auditLogger: AuditLogger;

  beforeEach(() => {
    connection = new SolanaConnection(
      "https://api.devnet.solana.com",
      "devnet",
    );
    auditLogger = new AuditLogger("/tmp/test-logs");
  });

  describe("create()", () => {
    it("should return null when masterSecretKey is undefined", () => {
      const funder = MasterFunder.create(
        undefined,
        0.05,
        connection,
        auditLogger,
      );
      expect(funder).toBeNull();
    });

    it("should return null when masterSecretKey is empty string", () => {
      const funder = MasterFunder.create("", 0.05, connection, auditLogger);
      expect(funder).toBeNull();
    });

    it("should return null when masterSecretKey is invalid base58", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const funder = MasterFunder.create(
        "not-a-valid-key!!!",
        0.05,
        connection,
        auditLogger,
      );
      expect(funder).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should return a MasterFunder when given a valid secret key", () => {
      const kp = createMasterKeypair();
      const funder = MasterFunder.create(
        encodedSecret(kp),
        0.1,
        connection,
        auditLogger,
      );
      expect(funder).not.toBeNull();
      expect(funder!.publicKey).toBe(kp.publicKey.toBase58());
      expect(funder!.seedSol).toBe(0.1);
    });
  });

  describe("properties", () => {
    it("should expose correct publicKey and seedSol", () => {
      const kp = createMasterKeypair();
      const funder = new MasterFunder(kp, 0.05, connection, auditLogger);
      expect(funder.publicKey).toBe(kp.publicKey.toBase58());
      expect(funder.seedSol).toBe(0.05);
      expect(funder.isConfigured).toBe(true);
    });
  });

  describe("fundWallet()", () => {
    it("should transfer SOL and return a signature", async () => {
      const masterKp = createMasterKeypair();
      const agentKp = Keypair.generate();
      const funder = new MasterFunder(masterKp, 0.05, connection, auditLogger);

      const signature = await funder.fundWallet(
        agentKp.publicKey.toBase58(),
        "test-wallet-id",
      );

      expect(signature).toBe("mock-signature-123");
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "master-fund:sent",
          walletId: "test-wallet-id",
          publicKey: agentKp.publicKey.toBase58(),
          txSignature: "mock-signature-123",
          success: true,
        }),
      );
    });

    it("should throw when master wallet has insufficient balance", async () => {
      const masterKp = createMasterKeypair();
      // Override getBalance to return very low balance
      const mockConn = connection.getConnection();
      (mockConn.getBalance as any).mockResolvedValueOnce(1_000); // way too low

      const funder = new MasterFunder(masterKp, 1.0, connection, auditLogger);

      await expect(
        funder.fundWallet(Keypair.generate().publicKey.toBase58(), "wallet-1"),
      ).rejects.toThrow("Master wallet has");

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "master-fund:failed",
          success: false,
        }),
      );
    });
  });

  describe("getBalance()", () => {
    it("should return the master wallet balance", async () => {
      const masterKp = createMasterKeypair();
      const funder = new MasterFunder(masterKp, 0.05, connection, auditLogger);

      const balance = await funder.getBalance();
      expect(balance.sol).toBe(10);
      expect(balance.lamports).toBe(10 * LAMPORTS_PER_SOL);
    });
  });
});
