/**
 * Full Demo Runner
 *
 * Runs all demo steps in sequence with delays between them.
 * Usage: npx tsx demo/run-demo.ts
 */

import { execSync } from "node:child_process";

const steps = [
  { script: "./01-create-agents.ts", label: "Step 1: Create Agent Wallets" },
  { script: "./02-fund-agents.ts", label: "Step 2: Fund Agent Wallets" },
  {
    script: "./03-run-agents.ts",
    label: "Step 3: Run Agent Strategies (60s)",
  },
  { script: "./04-observe.ts", label: "Step 4: Observe Results" },
];

async function main() {
  console.log("═".repeat(60));
  console.log("  🤖 Solana Agentic Wallet — Full Demo");
  console.log("═".repeat(60));
  console.log();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n${"─".repeat(60)}`);
    console.log(`  ${step.label}`);
    console.log(`${"─".repeat(60)}\n`);

    try {
      execSync(`npx tsx ${step.script}`, { stdio: "inherit" });
    } catch (error: any) {
      console.error(`\n❌ Step failed: ${step.label}`);
      console.error(error.message);
      process.exit(1);
    }

    // Pause between steps (except after the last one)
    if (i < steps.length - 1) {
      console.log("\n⏳ Waiting 3 seconds before next step...\n");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log("  ✅ Full demo completed successfully!");
  console.log("═".repeat(60));
}

main().catch(console.error);
