import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  X402Client,
  type PaymentRequired,
  type PaymentRequirements,
} from "../protocols/x402-client.js";
import { Transaction, PublicKey } from "@solana/web3.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePaymentRequired(
  overrides: Partial<PaymentRequirements> = {},
): PaymentRequired {
  return {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
        amount: "1000000",
        asset: "So11111111111111111111111111111111111111112",
        payTo: "11111111111111111111111111111111",
        maxTimeoutSeconds: 60,
        extra: {
          feePayer: "22222222222222222222222222222222",
        },
        ...overrides,
      },
    ],
  };
}

function encodePaymentRequired(pr: PaymentRequired): string {
  return Buffer.from(JSON.stringify(pr)).toString("base64");
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("X402Client", () => {
  let client: X402Client;

  beforeEach(() => {
    client = new X402Client({
      preferredNetwork: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      maxPaymentLamports: 10_000_000,
    });
  });

  describe("constructor", () => {
    it("should create client with default config", () => {
      const defaultClient = new X402Client();
      expect(defaultClient).toBeDefined();
    });

    it("should create client with custom config", () => {
      const customClient = new X402Client({
        preferredNetwork: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        autoRetry: false,
        maxPaymentLamports: 500_000,
      });
      expect(customClient).toBeDefined();
    });
  });

  describe("parsePaymentRequired", () => {
    it("should parse a valid PAYMENT-REQUIRED header", () => {
      const pr = makePaymentRequired();
      const encoded = encodePaymentRequired(pr);

      const mockResponse = {
        headers: new Map([["PAYMENT-REQUIRED", encoded]]),
      };
      // Simulate Response.headers.get
      const response = {
        headers: {
          get: (name: string) => (name === "PAYMENT-REQUIRED" ? encoded : null),
        },
      } as unknown as Response;

      const result = client.parsePaymentRequired(response);
      expect(result).not.toBeNull();
      expect(result!.x402Version).toBe(2);
      expect(result!.accepts).toHaveLength(1);
      expect(result!.accepts[0].scheme).toBe("exact");
    });

    it("should return null when header is missing", () => {
      const response = {
        headers: {
          get: () => null,
        },
      } as unknown as Response;

      const result = client.parsePaymentRequired(response);
      expect(result).toBeNull();
    });

    it("should return null for invalid base64", () => {
      const response = {
        headers: {
          get: (name: string) =>
            name === "PAYMENT-REQUIRED" ? "not-valid-base64!!!" : null,
        },
      } as unknown as Response;

      const result = client.parsePaymentRequired(response);
      expect(result).toBeNull();
    });
  });

  describe("selectRequirements", () => {
    it("should select matching SVM payment option", () => {
      const pr = makePaymentRequired();
      const result = client.selectRequirements(pr);
      expect(result).not.toBeNull();
      expect(result!.scheme).toBe("exact");
      expect(result!.network).toContain("solana:");
    });

    it("should return null when no SVM option exists", () => {
      const pr: PaymentRequired = {
        x402Version: 2,
        accepts: [
          {
            scheme: "exact",
            network: "eip155:1", // Ethereum, not Solana
            amount: "1000",
            asset: "0x...",
            payTo: "0x...",
            maxTimeoutSeconds: 60,
            extra: { feePayer: "0x..." },
          },
        ],
      };
      const result = client.selectRequirements(pr);
      expect(result).toBeNull();
    });

    it("should prefer the configured network", () => {
      const pr: PaymentRequired = {
        x402Version: 2,
        accepts: [
          {
            scheme: "exact",
            network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            amount: "2000",
            asset: "So11111111111111111111111111111111111111112",
            payTo: "11111111111111111111111111111111",
            maxTimeoutSeconds: 60,
            extra: { feePayer: "22222222222222222222222222222222" },
          },
          {
            scheme: "exact",
            network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            amount: "1000",
            asset: "So11111111111111111111111111111111111111112",
            payTo: "11111111111111111111111111111111",
            maxTimeoutSeconds: 60,
            extra: { feePayer: "22222222222222222222222222222222" },
          },
        ],
      };
      const result = client.selectRequirements(pr);
      expect(result).not.toBeNull();
      // Should pick the devnet option (our preferred network)
      expect(result!.amount).toBe("1000");
    });
  });

  describe("buildPaymentTransaction", () => {
    it("should build a valid transaction for native SOL", () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
        amount: "1000000",
        asset: "So11111111111111111111111111111111111111112",
        payTo: "11111111111111111111111111111111",
        maxTimeoutSeconds: 60,
        extra: {
          feePayer: "11111111111111111111111111111111",
        },
      };

      const walletPk = "11111111111111111111111111111111";
      const tx = client.buildPaymentTransaction(requirements, walletPk);

      expect(tx).toBeInstanceOf(Transaction);
      expect(tx.instructions).toHaveLength(3); // 2 compute budget + 1 transfer
      expect(tx.feePayer).toBeDefined();
    });

    it("should build a valid transaction for SPL token", () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
        amount: "1000000",
        asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
        payTo: "11111111111111111111111111111111",
        maxTimeoutSeconds: 60,
        extra: {
          feePayer: "11111111111111111111111111111111",
        },
      };

      const walletPk = "11111111111111111111111111111111";
      const tx = client.buildPaymentTransaction(requirements, walletPk);

      expect(tx).toBeInstanceOf(Transaction);
      expect(tx.instructions).toHaveLength(3); // 2 compute budget + 1 transferChecked
    });

    it("should set fee payer to the facilitator", () => {
      const feePayerKey = "11111111111111111111111111111111";
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
        amount: "1000",
        asset: "So11111111111111111111111111111111111111112",
        payTo: "11111111111111111111111111111111",
        maxTimeoutSeconds: 60,
        extra: { feePayer: feePayerKey },
      };

      const tx = client.buildPaymentTransaction(
        requirements,
        "11111111111111111111111111111111",
      );
      expect(tx.feePayer?.toBase58()).toBe(feePayerKey);
    });
  });

  describe("static methods", () => {
    it("formatAmount should format SOL amounts", () => {
      const result = X402Client.formatAmount(
        "1000000000",
        "So11111111111111111111111111111111111111112",
      );
      expect(result).toBe("1.000000 SOL");
    });

    it("formatAmount should format token amounts", () => {
      const result = X402Client.formatAmount(
        "1000000",
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      );
      expect(result).toBe("1.000000 tokens");
    });

    it("getNetworkId should return correct CAIP-2 ids", () => {
      expect(X402Client.getNetworkId("devnet")).toBe(
        "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      );
      expect(X402Client.getNetworkId("mainnet-beta")).toBe(
        "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      );
    });
  });

  describe("payForResource", () => {
    it("should return directly when response is not 402", async () => {
      // Mock fetch to return 200
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        text: async () => '{"data": "free resource"}',
        headers: {
          get: (name: string) =>
            name === "content-type" ? "application/json" : null,
        },
      });

      try {
        const result = await client.payForResource(
          "https://example.com/free",
          {},
          async (tx) => tx,
          "11111111111111111111111111111111",
        );

        expect(result.success).toBe(true);
        expect(result.httpStatus).toBe(200);
        expect(result.body).toContain("free resource");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should reject payment exceeding max amount", async () => {
      const pr = makePaymentRequired({ amount: "999999999999" }); // way over max
      const encoded = encodePaymentRequired(pr);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 402,
        ok: false,
        text: async () => "",
        headers: {
          get: (name: string) =>
            name === "PAYMENT-REQUIRED"
              ? encoded
              : name === "content-type"
                ? "text/plain"
                : null,
        },
      });

      try {
        const result = await client.payForResource(
          "https://example.com/paid",
          {},
          async (tx) => tx,
          "11111111111111111111111111111111",
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("exceeds max");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should not retry when autoRetry is disabled", async () => {
      const noRetryClient = new X402Client({ autoRetry: false });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 402,
        ok: false,
        text: async () => "",
        headers: {
          get: () => null,
        },
      });

      try {
        const result = await noRetryClient.payForResource(
          "https://example.com/paid",
          {},
          async (tx) => tx,
          "11111111111111111111111111111111",
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("autoRetry is disabled");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
