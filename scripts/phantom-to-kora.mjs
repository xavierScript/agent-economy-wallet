#!/usr/bin/env node
/**
 * scripts/phantom-to-kora.mjs
 *
 * Converts a base58-encoded Solana private key (exported from Phantom or any
 * Solana wallet) to the JSON byte-array format that Kora expects.
 *
 * Usage:
 *   node scripts/phantom-to-kora.mjs YOUR_BASE58_PRIVATE_KEY
 *
 * Output is written to kora/kora-signer.json.
 * Run from the repo root.
 *
 * Zero dependencies — uses only built-in Node.js APIs.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Base58 decode (no external deps) ─────────────────────────────────────────

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function decodeBase58(input) {
  let value = 0n;
  for (const char of input) {
    const digit = BASE58_ALPHABET.indexOf(char);
    if (digit < 0) throw new Error(`Invalid base58 character: '${char}'`);
    value = value * 58n + BigInt(digit);
  }

  // Convert BigInt → bytes (big-endian)
  const bytes = [];
  while (value > 0n) {
    bytes.unshift(Number(value & 0xffn));
    value >>= 8n;
  }

  // Preserve leading zeros (encoded as '1' chars in base58)
  const leadingZeros = [...input].findIndex((c) => c !== "1");
  const prefix = new Array(leadingZeros === -1 ? input.length : leadingZeros).fill(0);

  return new Uint8Array([...prefix, ...bytes]);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const base58Key = process.argv[2];
if (!base58Key) {
  console.error(
    "Usage: node scripts/phantom-to-kora.mjs <BASE58_PRIVATE_KEY>",
  );
  process.exit(1);
}

let bytes;
try {
  bytes = decodeBase58(base58Key);
} catch (e) {
  console.error("Failed to decode key:", e.message);
  process.exit(1);
}

if (bytes.length !== 64) {
  console.error(
    `Expected a 64-byte Solana keypair, got ${bytes.length} bytes.\n` +
      "Make sure you exported the private key (not just the public key) from Phantom.",
  );
  process.exit(1);
}

const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "kora",
);
const outPath = join(outDir, "kora-signer.json");

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(Array.from(bytes)) + "\n", "utf-8");

console.log(`✓ Wrote ${bytes.length}-byte keypair to: kora/kora-signer.json`);
console.log("  Remember to clear your terminal history.");
