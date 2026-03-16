import { describe, it, expect } from "vitest";
import { getDefaultConfig } from "../core/config.js";

describe("getDefaultConfig", () => {
  it("should return a valid config object", () => {
    const config = getDefaultConfig();
    expect(config).toBeDefined();
    expect(config.cluster).toBeDefined();
    expect(config.keystoreDir).toBeDefined();
    expect(config.logDir).toBeDefined();
    expect(config.passphrase).toBeDefined();
    expect(config.logLevel).toBeDefined();
  });

  it("should default to devnet cluster", () => {
    const config = getDefaultConfig();
    expect(config.cluster).toBe("devnet");
  });

  it("should default to devnet RPC URL", () => {
    const config = getDefaultConfig();
    expect(config.rpcUrl).toContain("devnet");
  });

  it("should use home directory for keystore", () => {
    const config = getDefaultConfig();
    expect(config.keystoreDir).toContain(".agent-economy-wallet");
    expect(config.keystoreDir).toContain("keys");
  });

  it("should use home directory for logs", () => {
    const config = getDefaultConfig();
    expect(config.logDir).toContain(".agent-economy-wallet");
    expect(config.logDir).toContain("logs");
  });
});
