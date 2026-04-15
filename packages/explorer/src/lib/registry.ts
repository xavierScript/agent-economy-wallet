/**
 * lib/registry.ts
 *
 * Server-side data-fetching layer for the Agent Economy Explorer.
 *
 * Rather than importing the full @agent-economy-wallet/core package (which
 * pulls in Node-only crypto / keypair utilities that break Next.js bundling),
 * we replicate just the SPL Memo registry-read logic here using only
 * @solana/web3.js — which Next.js handles fine.
 *
 * This keeps the explorer self-contained and deployable to Vercel without
 * any extra webpack shimming.
 */

import { Connection, PublicKey } from "@solana/web3.js";

// ── Configuration ────────────────────────────────────────────────────────

const SOLANA_RPC =
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const REGISTRY_ADDRESS =
  process.env.REGISTRY_WALLET_ADDRESS ??
  "regXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

// ── Types ────────────────────────────────────────────────────────────────

export interface AgentMemo {
  agent: string;
  manifest: string;
  v: number;
}

export interface ServiceInfo {
  name?: string;
  description?: string;
  price?: string | number;
  currency?: string;
  endpoint?: string;
  [key: string]: unknown;
}

export interface DiscoveredAgent {
  name: string;
  manifest_url: string;
  registered_by: string;
  registered_at: string;
  registration_tx: string;
  services: ServiceInfo[];
}

export interface RegistrySnapshot {
  agents: DiscoveredAgent[];
  fetched_at: string;
  network: string;
  registry_address: string;
  total_services: number;
  total_registrations: number;
  protocol_volume_usdc: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function parseAgentMemo(raw: string): AgentMemo | null {
  try {
    const obj = JSON.parse(raw);
    if (
      typeof obj.agent === "string" &&
      typeof obj.manifest === "string" &&
      typeof obj.v === "number"
    ) {
      return obj as AgentMemo;
    }
  } catch {
    // not valid JSON
  }
  return null;
}

function extractMemoFromInstructions(instructions: any[]): string | null {
  for (const ix of instructions) {
    const programId =
      typeof ix.programId === "string"
        ? ix.programId
        : ix.programId?.toBase58?.();

    if (programId === MEMO_PROGRAM_ID) {
      if ("parsed" in ix) return String(ix.parsed);
      if ("data" in ix) {
        // base58-encoded data — decode
        try {
          const bytes = Buffer.from(ix.data, "base64");
          const text = bytes.toString("utf-8");
          // If it looks like JSON, return it
          if (text.startsWith("{")) return text;
        } catch {
          // fall through
        }
        // Try base58 decoding
        try {
          const alphabet =
            "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
          let result = BigInt(0);
          for (const char of ix.data as string) {
            const charIndex = alphabet.indexOf(char);
            if (charIndex === -1) break;
            result = result * BigInt(58) + BigInt(charIndex);
          }
          const hex = result.toString(16);
          const paddedHex = hex.length % 2 ? "0" + hex : hex;
          const buf = Buffer.from(paddedHex, "hex");
          const decoded = buf.toString("utf-8");
          if (decoded.startsWith("{")) return decoded;
        } catch {
          // ignore
        }
      }
    }
  }
  return null;
}

// ── Main fetch ───────────────────────────────────────────────────────────

/**
 * Fetch the full registry snapshot from the Solana blockchain.
 * This is designed to run server-side in Next.js (RSC or API route).
 */
export async function fetchRegistrySnapshot(
  limit: number = 100,
): Promise<RegistrySnapshot> {
  const connection = new Connection(SOLANA_RPC, "confirmed");

  // Step 1: Get recent transaction signatures
  let signatures: Awaited<
    ReturnType<typeof connection.getSignaturesForAddress>
  > = [];

  try {
    const registryPubkey = new PublicKey(REGISTRY_ADDRESS);
    signatures = await connection.getSignaturesForAddress(registryPubkey, {
      limit,
    });
  } catch (err) {
    console.error("[Explorer] Failed to fetch signatures:", err);
  }

  const totalRegistrations = signatures.length;
  const agents: DiscoveredAgent[] = [];
  const seenManifests = new Set<string>();

  // Step 2: Parse each transaction
  for (const sigInfo of signatures) {
    try {
      const tx = await connection.getParsedTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx?.transaction?.message?.instructions) continue;

      const memoText = extractMemoFromInstructions(
        tx.transaction.message.instructions,
      );
      if (!memoText) continue;

      const memo = parseAgentMemo(memoText);
      if (!memo) continue;

      // Deduplicate by manifest URL
      if (seenManifests.has(memo.manifest)) continue;
      seenManifests.add(memo.manifest);

      // Step 3: Verify manifest is still live
      try {
        const resp = await fetch(memo.manifest, {
          signal: AbortSignal.timeout(5000),
          cache: "no-store",
        });
        if (!resp.ok) continue;

        const manifest = (await resp.json()) as any;
        if (
          !manifest?.services ||
          !Array.isArray(manifest.services) ||
          manifest.services.length === 0
        )
          continue;

        const signer =
          tx.transaction.message.accountKeys?.[0]?.pubkey?.toBase58?.() ??
          "unknown";

        agents.push({
          name: memo.agent,
          manifest_url: memo.manifest,
          registered_by: signer,
          registered_at: sigInfo.blockTime
            ? new Date(sigInfo.blockTime * 1000).toISOString()
            : "unknown",
          registration_tx: sigInfo.signature,
          services: manifest.services,
        });
      } catch {
        // Manifest unreachable — skip
      }
    } catch {
      // Transaction parse failed — skip
    }
  }

  const totalServices = agents.reduce((s, a) => s + a.services.length, 0);

  const network = SOLANA_RPC.includes("devnet")
    ? "Devnet"
    : SOLANA_RPC.includes("mainnet")
      ? "Mainnet"
      : "Custom";

  // Estimate protocol volume from service prices in manifests
  let protocolVolumeUsdc = 0;
  for (const agent of agents) {
    for (const svc of agent.services) {
      const price = svc.price ?? svc.cost ?? 0;
      if (typeof price === "number") protocolVolumeUsdc += price;
    }
  }

  return {
    agents,
    fetched_at: new Date().toISOString(),
    network,
    registry_address: REGISTRY_ADDRESS,
    total_services: totalServices,
    total_registrations: totalRegistrations,
    protocol_volume_usdc: protocolVolumeUsdc,
  };
}

// ── Health Ping ──────────────────────────────────────────────────────────

export type AgentHealthStatus = "online" | "slow" | "offline";

export interface AgentHealth {
  manifest_url: string;
  status: AgentHealthStatus;
  latency_ms: number;
}

/**
 * Ping an agent's manifest URL to determine health.
 * < 2000ms = online, > 2000ms = slow, failed = offline
 */
export async function pingAgentHealth(
  manifestUrl: string,
): Promise<AgentHealth> {
  const start = Date.now();
  try {
    const resp = await fetch(manifestUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const latency = Date.now() - start;

    if (!resp.ok) {
      return { manifest_url: manifestUrl, status: "offline", latency_ms: latency };
    }

    return {
      manifest_url: manifestUrl,
      status: latency > 2000 ? "slow" : "online",
      latency_ms: latency,
    };
  } catch {
    return {
      manifest_url: manifestUrl,
      status: "offline",
      latency_ms: Date.now() - start,
    };
  }
}
