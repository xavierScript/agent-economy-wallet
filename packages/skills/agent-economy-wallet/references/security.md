# Agent Economy Wallet Security Model

How Agent Economy Wallet protects private keys and prevents unauthorized access.

## Threat Model

Agent Economy Wallet is designed to protect against:

| Threat                     | Mitigation                                                               |
| -------------------------- | ------------------------------------------------------------------------ |
| Key theft from disk        | Keys are encrypted on disk using AES-256-GCM. Raw keys are never stored. |
| Key theft from memory      | Derive-and-discard pattern — keys exist only during signing              |
| Encrypted seed brute force | AES-256-GCM with PBKDF2 (210,000 iterations, SHA-512)                    |
| Man-in-the-middle (RPC)    | HTTPS-only connections to all endpoints                                  |
| Single point of compromise | Encryption passphrase separated from keystore payload                    |

## Key Management

**Stored:** Encrypted keypair blob in `~/.agent-economy-wallet/keys/` and `WALLET_PASSPHRASE` in `.env`.

**Never stored:** Private keys in plaintext in git or final environments.

**Signing flow:**

1. Read encrypted blob from the filesystem.
2. Decrypt with PBKDF2-derived key (210,000 iterations, SHA-512, using `WALLET_PASSPHRASE`).
3. Sign the transaction.
4. Keypair falls out of function scope → garbage collected.
5. Encrypted blob remains unchanged.

_Window of exposure:_ Private key exists in memory only during the signing or sending function call (~10ms).

## Encryption Specification

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **KDF:** PBKDF2
- **Hash:** SHA-512
- **Iterations:** 210,000
- **Salt:** 32 bytes (cryptographically random, unique per encryption)
- **IV/Nonce:** 16 bytes (cryptographically random, unique per encryption)
- **Auth Tag:** 16 bytes (integrity verification)

### Why AES-256-GCM?

- **Authenticated:** The auth tag ensures ciphertext hasn't been tampered with. Decrypting modified ciphertext fails rather than producing garbage.
- **Standard:** NIST approved, widely audited, hardware-accelerated on modern CPUs (AES-NI).
- **210K PBKDF2 iterations:** Makes brute-force password cracking computationally expensive.

## Environment Variable Security

Recommended practices:

- **Never commit `.env` to git** — `.gitignore` includes `.env` by default.
- **Use secrets management in production** — AWS Secrets Manager, Vault, etc.
- **Separate environments** — Different `.env` for dev/staging/production.
- **File permissions** — `chmod 600 .env` (owner read/write only).

## What Agent Economy Wallet Does NOT Protect Against

- **Compromised host machine** — If the attacker has root access to the machine running the agent, they can read environment variables, intercept memory, etc.
- **Compromised agent logic** — If the agent's decision-making is manipulated (prompt injection), the wallet will faithfully execute transactions if under the policy limits. This is an agent-framework concern, not a wallet concern.
- **Network-level attacks on Solana** — We rely on Solana's security guarantees for on-chain finality.
