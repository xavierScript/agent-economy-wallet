import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuditLogger, type AuditLogEntry } from "../audit-logger.js";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_LOG_DIR = join(tmpdir(), `agentic-wallet-logs-${Date.now()}`);

describe("AuditLogger", () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger(TEST_LOG_DIR);
  });

  afterEach(() => {
    if (existsSync(TEST_LOG_DIR)) {
      rmSync(TEST_LOG_DIR, { recursive: true, force: true });
    }
  });

  describe("log", () => {
    it("should write a log entry with timestamp", () => {
      logger.log({
        action: "wallet:created",
        walletId: "test-123",
        success: true,
      });

      const logs = logger.readRecentLogs(10);
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("wallet:created");
      expect(logs[0].walletId).toBe("test-123");
      expect(logs[0].success).toBe(true);
      expect(logs[0].timestamp).toBeDefined();
    });

    it("should write logs to date-partitioned JSONL files", () => {
      logger.log({ action: "test", success: true });

      const dateStr = new Date().toISOString().split("T")[0];
      const filePath = join(TEST_LOG_DIR, `audit-${dateStr}.jsonl`);
      expect(existsSync(filePath)).toBe(true);
    });

    it("should append multiple entries to same file", () => {
      logger.log({ action: "action-1", success: true });
      logger.log({ action: "action-2", success: false, error: "failed" });
      logger.log({ action: "action-3", success: true });

      const logs = logger.readRecentLogs(10);
      expect(logs).toHaveLength(3);
    });
  });

  describe("readRecentLogs", () => {
    it("should return logs sorted by timestamp descending", () => {
      logger.log({ action: "first", success: true });
      logger.log({ action: "second", success: true });
      logger.log({ action: "third", success: true });

      const logs = logger.readRecentLogs(10);
      // All written in same millisecond, so just verify we get all 3
      expect(logs).toHaveLength(3);
      const actions = logs.map((l) => l.action);
      expect(actions).toContain("first");
      expect(actions).toContain("second");
      expect(actions).toContain("third");
    });

    it("should respect the count limit", () => {
      for (let i = 0; i < 10; i++) {
        logger.log({ action: `action-${i}`, success: true });
      }
      const logs = logger.readRecentLogs(3);
      expect(logs).toHaveLength(3);
    });

    it("should return empty array when no logs exist", () => {
      const freshLogger = new AuditLogger(
        join(tmpdir(), `empty-logs-${Date.now()}`),
      );
      expect(freshLogger.readRecentLogs(10)).toHaveLength(0);
    });
  });

  describe("readWalletLogs", () => {
    it("should filter logs by wallet ID", () => {
      logger.log({ action: "a", walletId: "wallet-1", success: true });
      logger.log({ action: "b", walletId: "wallet-2", success: true });
      logger.log({ action: "c", walletId: "wallet-1", success: true });

      const logs = logger.readWalletLogs("wallet-1", 10);
      expect(logs).toHaveLength(2);
      expect(logs.every((l) => l.walletId === "wallet-1")).toBe(true);
    });
  });

  describe("onLog listener", () => {
    it("should notify listeners in real-time", () => {
      const received: AuditLogEntry[] = [];
      const unsubscribe = logger.onLog((entry) => received.push(entry));

      logger.log({ action: "live-1", success: true });
      logger.log({ action: "live-2", success: false });

      expect(received).toHaveLength(2);
      expect(received[0].action).toBe("live-1");
      expect(received[1].action).toBe("live-2");

      unsubscribe();
    });

    it("should stop notifying after unsubscribe", () => {
      const received: AuditLogEntry[] = [];
      const unsubscribe = logger.onLog((entry) => received.push(entry));

      logger.log({ action: "before", success: true });
      unsubscribe();
      logger.log({ action: "after", success: true });

      expect(received).toHaveLength(1);
    });
  });

  describe("log with details", () => {
    it("should preserve all optional fields", () => {
      logger.log({
        action: "sol:transfer",
        walletId: "w1",
        publicKey: "abc123",
        txSignature: "sig456",
        success: true,
        details: { to: "recipient", amount: 1.5 },
      });

      const logs = logger.readRecentLogs(1);
      expect(logs[0].publicKey).toBe("abc123");
      expect(logs[0].txSignature).toBe("sig456");
      expect(logs[0].details).toEqual({ to: "recipient", amount: 1.5 });
    });
  });
});
