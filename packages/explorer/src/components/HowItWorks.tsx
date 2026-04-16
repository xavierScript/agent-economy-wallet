"use client";

import { useState, useEffect, useRef } from "react";
import { Search, FileText, Star, Tag, ShieldCheck, Coins, CheckSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  {
    number: "01",
    icon: Search,
    title: "Discover",
    tool: "discover_registry",
    description: "Scans Solana for registered merchants via SPL Memo",
    log: (
      <>
        <span className="terminal-cmd">&gt; agent-mcp tool call discover_registry</span>{"\n"}
        <span className="terminal-info">[Info] Scanning Solana network for active AI merchants...</span>{"\n"}
        [Wait] Parsing SPL Memo program transactions...{"\n"}
        [Ok] Found 14 matching agents offering "data_analysis"{"\n"}
        {`=>`} Target Agent PublicKey: <span className="terminal-success">7xDp...3qLp</span>
      </>
    )
  },
  {
    number: "02",
    icon: FileText,
    title: "Read Manifest",
    tool: "read_manifest",
    description: "Fetches /.well-known/agent.json from a merchant",
    log: (
      <>
        <span className="terminal-cmd">&gt; curl https://agent.target.local/.well-known/agent.json</span>{"\n"}
        <span className="terminal-info">[HTTP] Fetching agent manifest...</span>{"\n"}
        [Ok] 200 OK{"\n"}
        {"{"}{"\n"}
        {"  \"name\": \"DataCruncher AI\",\n"}
        {"  \"wallet\": \"7xDp...3qLp\",\n"}
        {"  \"services\": [\n"}
        {"    { \"name\": \"analyze\", \"price\": \"0.5\", \"currency\": \"USDC\" }\n"}
        {"  ]\n"}
        {"}"}
      </>
    )
  },
  {
    number: "03",
    icon: Star,
    title: "Check Reputation",
    tool: "check_reputation",
    description: "Queries on-chain reputation — success rate, volume",
    log: (
      <>
        <span className="terminal-cmd">&gt; agent-mcp tool call check_reputation pubkey=7xDp...3qLp</span>{"\n"}
        <span className="terminal-info">[RPC] Querying Solana Reputation Program...</span>{"\n"}
        [Wait] Fetching staking and rating accounts...{"\n"}
        [Ok] Reputation Score: <span className="terminal-success">4.92 / 5.00</span>{"\n"}
        [Ok] Total Volume: 14,024 USDC{"\n"}
        {`=>`} Agent is highly trusted. Proceeding with execution.
      </>
    )
  },
  {
    number: "04",
    icon: Tag,
    title: "Probe Price",
    tool: "probe_x402",
    description: "Confirms price on the x402-gated endpoint",
    log: (
      <>
        <span className="terminal-cmd">&gt; curl -X OPTIONS https://api.agent.target/analyze</span>{"\n"}
        <span className="terminal-info">[HTTP] Probing x402 endpoint pricing...</span>{"\n"}
        [Wait] Receiving 402 Payment Required{"\n"}
        {`=>`} Header x-solana-pay: solana:7xDp...3qLp?amount=0.5&spl-token=usdc{"\n"}
        {`=>`} Requested Price: <span className="terminal-warning">0.5 USDC</span>
      </>
    )
  },
  {
    number: "05",
    icon: ShieldCheck,
    title: "Policy Check",
    tool: "policy_engine",
    description: "Wallet policy engine approves the spend",
    log: (
      <>
        <span className="terminal-cmd">&gt; agent-mcp policy check --amount 0.5 --currency USDC</span>{"\n"}
        <span className="terminal-info">[Auth] Evaluating spending policy for current session...</span>{"\n"}
        [Policy] Rule: max_spend_per_tx {`<=`} 5.0 USDC{"\n"}
        [Policy] Rule: allowed_merchants = "ANY"{"\n"}
        {`=>`} Policy Engine: <span className="terminal-success">APPROVED</span> (0.5 {`<=`} 5.0)
      </>
    )
  },
  {
    number: "06",
    icon: Coins,
    title: "Pay",
    tool: "pay_x402_invoice",
    description: "USDC payment → Solana tx confirmed on-chain",
    log: (
      <>
        <span className="terminal-cmd">&gt; agent-mcp tool call pay_x402_invoice amount=0.5</span>{"\n"}
        <span className="terminal-info">[Tx] Constructing SPL Token Transfer...</span>{"\n"}
        [Tx] Adding Protocol Fee instruction (0.0025 USDC){"\n"}
        [Wait] Signing transaction...{"\n"}
        [Wait] Sending to network...{"\n"}
        {`=>`} Transaction Confirmed: <span className="terminal-success">tx_8a9B...4dEf</span>
      </>
    )
  },
  {
    number: "07",
    icon: CheckSquare,
    title: "Data Returned",
    tool: "response",
    description: "Purchased data returned autonomously",
    log: (
      <>
        <span className="terminal-cmd">&gt; curl -H "Authorization: Bearer tx_8a9B...4dEf" https://api.agent.target/analyze</span>{"\n"}
        <span className="terminal-info">[HTTP] Sending request with payment proof...</span>{"\n"}
        [Ok] 200 OK - Payment verified on-chain.{"\n"}
        {`=>`} <span className="terminal-success">Data payload received successfully.</span>{"\n"}
        [System] Terminating autonomous step loop.
      </>
    )
  }
];

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const activeStepRef = useRef<HTMLDivElement>(null);

  // Auto-cycle through steps
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll on mobile
  useEffect(() => {
    if (activeStepRef.current && window.innerWidth <= 768) {
      activeStepRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeStep]);

  return (
    <section className="how-it-works">
      <div className="how-it-works-header">
        <span className="how-eyebrow">The Protocol</span>
        <h2 className="how-title">
          Autonomous Agent-to-Agent Payments
        </h2>
        <p className="how-subtitle">
          No human touches steps 1–7. AI agents discover, evaluate, pay, and
          receive data — all on Solana.
        </p>
      </div>

      <div className="terminal-split">
        {/* Left Side: Step List */}
        <div className="terminal-sidebar">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === activeStep;
            return (
              <div 
                key={step.number} 
                ref={isActive ? activeStepRef : null}
                className={`terminal-step ${isActive ? "active" : ""}`}
                onClick={() => setActiveStep(i)}
                onMouseEnter={() => setActiveStep(i)}
              >
                <div className="terminal-step-number">{step.number}</div>
                <div className="terminal-step-content">
                  <div className="terminal-step-title">
                    <Icon size={14} style={{ display: "inline", marginBottom: "2px", marginRight: "6px" }} />
                    {step.title}
                  </div>
                  <div className="terminal-step-desc">{step.description}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Side: Terminal Window */}
        <div className="terminal-window">
          <div className="terminal-header">
            <span className="terminal-dot red" />
            <span className="terminal-dot yellow" />
            <span className="terminal-dot green" />
            <span style={{ marginLeft: "12px", fontSize: "0.75rem", color: "#666", fontFamily: 'var(--font-mono)' }}>
              {STEPS[activeStep].tool} — bash
            </span>
          </div>
          <div className="terminal-body">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
              >
                {STEPS[activeStep].log}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
