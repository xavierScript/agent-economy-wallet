# Policy Engine — Scoped Permissions

A policy may be active on this agent wallet. The policy engine enforces spend limits, rate limits, program allowlists, and time controls **before signing any transaction**.

## What you need to know as an agent

1. **Transactions can be rejected.** If a send or sign violates a policy scope, the wallet throws a `PolicyViolationError` with a `scope` (e.g., `maxSolPerTx`) and a human-readable `reason`.
2. **Report violations clearly.** When a transaction is blocked, tell the user:
   - _"Transaction blocked by policy: [reason]"_
   - Which limit was hit and the current value
   - Do NOT retry—the same tx will be blocked again unless the user changes the policy.
3. **You cannot change policy.** Only the human operator can adjust limits. Do not attempt to modify the policy file yourself.
4. **Pause state.** If signing is paused, ALL signing is suspended. Tell the user: _"Signing is paused by policy."_
5. **Remaining budget.** You do not need to pre-check the remaining budget before every tx—the engine checks automatically.
6. **x402 Guardrails.** HTTP-native web3 payments pass through the exact same Policy Engine bounds as manual sends to prevent run-away AI spending API fees.

## Common PolicyViolationError scopes

| Scope             | Meaning                                         |
| ----------------- | ----------------------------------------------- |
| `maxSolPerTx`     | Single tx exceeds per-transaction SOL limit     |
| `maxSolPerDay`    | Daily SOL spend limit reached                   |
| `maxTxPerHour`    | Hourly transaction count limit reached          |
| `allowedPrograms` | Transaction interacts with a disallowed program |
| `paused`          | Kill switch is active                           |
| `activeHours`     | Outside permitted operating hours               |
