/**
 * __tests__/x402-server.test.ts
 *
 * Tests for X402ServerService and withX402Paywall audit logging.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { X402ServerService, withX402Paywall } from "../protocols/x402-server.js";
import type { AuditLogEntry } from "../core/audit-logger.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal AuditLogger stub that captures log calls. */
function makeLogger() {
  const entries: AuditLogEntry[] = [];
  return {
    log: vi.fn((entry: Omit<AuditLogEntry, "timestamp">) => {
      entries.push({ timestamp: new Date().toISOString(), ...entry });
    }),
    entries,
  };
}

/** Build a minimal X402ServerService with a mock logger. */
function makeService(logger: ReturnType<typeof makeLogger>) {
  // Connection not used in these tests — verifyPayment is mocked separately
  const fakeConnection = {} as any;
  const svc = new X402ServerService(fakeConnection, logger as any);
  return svc;
}

const PRICE_STR = "0.1 USDC";
const PRICE_RAW = 100_000; // 0.1 USDC in base units
const MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC devnet
const MERCHANT = "MerchantWallet11111111111111111111111111111";
const SIG = "5validSignature1111111111111111111111111111111111111111111111111";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("withX402Paywall — audit logging", () => {
  let logger: ReturnType<typeof makeLogger>;
  let service: X402ServerService;

  beforeEach(() => {
    logger = makeLogger();
    service = makeService(logger);
  });

  // ── Misconfigured (no merchant address) ────────────────────────────────────

  it("logs x402:server:misconfigured when merchantAddress is undefined", async () => {
    const handler = vi.fn();
    const wrapped = withX402Paywall(
      service,
      PRICE_STR,
      PRICE_RAW,
      MINT,
      undefined, // no merchant address
      handler,
    );

    await expect(wrapped({ receipt_signature: SIG })).rejects.toThrow();

    expect(logger.log).toHaveBeenCalledOnce();
    const entry = logger.entries[0];
    expect(entry.action).toBe("x402:server:misconfigured");
    expect(entry.success).toBe(false);
  });

  // ── Payment required (no receipt_signature) ────────────────────────────────

  it("logs x402:server:payment-required when receipt_signature is absent", async () => {
    const handler = vi.fn();
    const wrapped = withX402Paywall(
      service,
      PRICE_STR,
      PRICE_RAW,
      MINT,
      MERCHANT,
      handler,
    );

    await expect(wrapped({} as any)).rejects.toThrow();

    expect(logger.log).toHaveBeenCalledOnce();
    const entry = logger.entries[0];
    expect(entry.action).toBe("x402:server:payment-required");
    expect(entry.success).toBe(false);
    expect((entry.details as any)?.merchant).toBe(MERCHANT);
    expect((entry.details as any)?.amountStr).toBe(PRICE_STR);
  });

  // ── Verification failed ────────────────────────────────────────────────────

  it("logs x402:server:failed when verifyPayment rejects", async () => {
    const verifyError = new Error("Insufficient payment: received 0, expected 100000");
    vi.spyOn(service, "verifyPayment").mockRejectedValueOnce(verifyError);

    const handler = vi.fn();
    const wrapped = withX402Paywall(
      service,
      PRICE_STR,
      PRICE_RAW,
      MINT,
      MERCHANT,
      handler,
    );

    await expect(wrapped({ receipt_signature: SIG })).rejects.toThrow();

    expect(logger.log).toHaveBeenCalledOnce();
    const entry = logger.entries[0];
    expect(entry.action).toBe("x402:server:failed");
    expect(entry.success).toBe(false);
    expect(entry.txSignature).toBe(SIG);
    expect(entry.error).toContain("Insufficient payment");
  });

  // ── Verified ──────────────────────────────────────────────────────────────

  it("logs x402:server:verified when payment is valid and calls the handler", async () => {
    vi.spyOn(service, "verifyPayment").mockResolvedValueOnce(true);

    const handlerResult = { data: "protected resource" };
    const handler = vi.fn().mockResolvedValueOnce(handlerResult);

    const wrapped = withX402Paywall(
      service,
      PRICE_STR,
      PRICE_RAW,
      MINT,
      MERCHANT,
      handler,
    );

    const result = await wrapped({ receipt_signature: SIG });

    expect(result).toEqual(handlerResult);
    expect(handler).toHaveBeenCalledOnce();

    expect(logger.log).toHaveBeenCalledOnce();
    const entry = logger.entries[0];
    expect(entry.action).toBe("x402:server:verified");
    expect(entry.success).toBe(true);
    expect(entry.txSignature).toBe(SIG);
    expect((entry.details as any)?.merchant).toBe(MERCHANT);
    expect((entry.details as any)?.amount).toBe(PRICE_RAW);
  });

  // ── No logger wired (optional) ─────────────────────────────────────────────

  it("works without a logger — does NOT throw", async () => {
    const noLogService = new X402ServerService({} as any); // no logger
    vi.spyOn(noLogService, "verifyPayment").mockResolvedValueOnce(true);

    const handler = vi.fn().mockResolvedValueOnce("ok");
    const wrapped = withX402Paywall(
      noLogService,
      PRICE_STR,
      PRICE_RAW,
      MINT,
      MERCHANT,
      handler,
    );

    await expect(wrapped({ receipt_signature: SIG })).resolves.toBe("ok");
  });
});
