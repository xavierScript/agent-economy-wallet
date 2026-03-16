import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { KeyManager } from "../core/key-manager.js";
import { mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import bs58 from "bs58";

const TEST_DIR = join(tmpdir(), `agent-economy-wallet-test-${Date.now()}`);
const PASSPHRASE = "test-secure-passphrase-123";

describe("KeyManager", () => {
  let km: KeyManager;

  beforeEach(() => {
    km = new KeyManager(TEST_DIR, PASSPHRASE);
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("createWallet", () => {
    it("should create a wallet with a unique ID and public key", () => {
      const wallet = km.createWallet("test-wallet");
      expect(wallet.id).toBeDefined();
      expect(wallet.publicKey).toBeDefined();
      expect(wallet.label).toBe("test-wallet");
      // base58 Solana pubkeys are 32-44 chars (typically 43-44)
      expect(wallet.publicKey.length).toBeGreaterThanOrEqual(32);
      expect(wallet.publicKey.length).toBeLessThanOrEqual(44);
    });

    it("should persist wallet keystore to disk", () => {
      const wallet = km.createWallet("persist-test");
      const filePath = join(TEST_DIR, `${wallet.id}.json`);
      expect(existsSync(filePath)).toBe(true);
    });

    it("should encrypt private key with AES-256-GCM", () => {
      const wallet = km.createWallet("crypto-test");
      expect(wallet.crypto.cipher).toBe("aes-256-gcm");
      expect(wallet.crypto.kdf).toBe("pbkdf2");
      expect(wallet.crypto.kdfparams.iterations).toBe(210_000);
      expect(wallet.crypto.kdfparams.digest).toBe("sha512");
      expect(wallet.crypto.ciphertext).toBeDefined();
      expect(wallet.crypto.iv).toBeDefined();
      expect(wallet.crypto.authTag).toBeDefined();
    });

    it("should use unique salt and IV per wallet", () => {
      const w1 = km.createWallet("wallet-1");
      const w2 = km.createWallet("wallet-2");
      expect(w1.crypto.kdfparams.salt).not.toBe(w2.crypto.kdfparams.salt);
      expect(w1.crypto.iv).not.toBe(w2.crypto.iv);
    });

    it("should store metadata", () => {
      const wallet = km.createWallet("meta-test", { role: "trader" });
      expect(wallet.metadata).toEqual({ role: "trader" });
    });
  });

  describe("unlockWallet", () => {
    it("should decrypt and return a valid Keypair", () => {
      const wallet = km.createWallet("unlock-test");
      const keypair = km.unlockWallet(wallet.id);
      expect(keypair.publicKey.toBase58()).toBe(wallet.publicKey);
      expect(keypair.secretKey).toHaveLength(64);
    });

    it("should fail with wrong passphrase", () => {
      const wallet = km.createWallet("wrong-pass-test");
      const wrongKm = new KeyManager(TEST_DIR, "wrong-passphrase");
      expect(() => wrongKm.unlockWallet(wallet.id)).toThrow();
    });

    it("should fail for non-existent wallet", () => {
      expect(() => km.unlockWallet("non-existent-id")).toThrow(
        "Wallet keystore not found",
      );
    });
  });

  describe("listWallets", () => {
    it("should return empty array when no wallets exist", () => {
      expect(km.listWallets()).toHaveLength(0);
    });

    it("should list all created wallets", () => {
      km.createWallet("wallet-a");
      km.createWallet("wallet-b");
      km.createWallet("wallet-c");
      const wallets = km.listWallets();
      expect(wallets).toHaveLength(3);
      const labels = wallets.map((w) => w.label);
      expect(labels).toContain("wallet-a");
      expect(labels).toContain("wallet-b");
      expect(labels).toContain("wallet-c");
    });
  });

  describe("importWallet", () => {
    it("should import a wallet from secret key and produce same pubkey", () => {
      const original = km.createWallet("original");
      const keypair = km.unlockWallet(original.id);

      // Import using the secret key
      const secretB58 = bs58.encode(keypair.secretKey);
      const imported = km.importWallet(secretB58, "imported-wallet");

      expect(imported.publicKey).toBe(original.publicKey);
      expect(imported.metadata).toHaveProperty("imported", true);
    });
  });

  describe("deleteWallet", () => {
    it("should delete wallet keystore from disk", () => {
      const wallet = km.createWallet("delete-me");
      const filePath = join(TEST_DIR, `${wallet.id}.json`);
      expect(existsSync(filePath)).toBe(true);

      km.deleteWallet(wallet.id);
      expect(existsSync(filePath)).toBe(false);
    });

    it("should not throw when deleting non-existent wallet", () => {
      expect(() => km.deleteWallet("non-existent")).not.toThrow();
    });
  });

  describe("loadKeystore", () => {
    it("should load keystore entry without decrypting", () => {
      const wallet = km.createWallet("load-test");
      const loaded = km.loadKeystore(wallet.id);
      expect(loaded.id).toBe(wallet.id);
      expect(loaded.publicKey).toBe(wallet.publicKey);
      expect(loaded.crypto.ciphertext).toBeDefined();
    });
  });
});
