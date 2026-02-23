import { Agent, AgentStatus, type AgentConfig } from "./agent.js";
import { EventBus, type AgentEvent } from "./event-bus.js";
import type { WalletService, ISwapClient } from "@agentic-wallet/core";
import { DCAStrategy } from "./strategies/dca.js";
import { RebalanceStrategy } from "./strategies/rebalance.js";
import { LiquidityStrategy } from "./strategies/liquidity.js";
import { ArbitrageStrategy } from "./strategies/arbitrage.js";
import type { IAgentStrategy } from "./strategies/base.js";

/**
 * Strategy registry — maps strategy names to constructors.
 */
const STRATEGY_REGISTRY: Record<string, () => IAgentStrategy> = {
  dca: () => new DCAStrategy(),
  rebalance: () => new RebalanceStrategy(),
  liquidity: () => new LiquidityStrategy(),
  arbitrage: () => new ArbitrageStrategy(),
};

/**
 * AgentOrchestrator manages multiple agents.
 * It handles spawning, lifecycle, and provides a single event bus
 * that the dashboard/CLI can subscribe to.
 */
export class AgentOrchestrator {
  private agents: Map<string, Agent> = new Map();
  private eventBus: EventBus;
  private walletService: WalletService;
  private swapClient: ISwapClient;

  constructor(walletService: WalletService, swapClient: ISwapClient) {
    this.walletService = walletService;
    this.swapClient = swapClient;
    this.eventBus = new EventBus();
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Spawn a new agent with a named strategy.
   */
  async spawnAgent(params: {
    name: string;
    walletId: string;
    strategyName: string;
    strategyConfig?: Record<string, unknown>;
    tickIntervalMs?: number;
    autoStart?: boolean;
  }): Promise<Agent> {
    const {
      name,
      walletId,
      strategyName,
      strategyConfig = {},
      tickIntervalMs = 60_000,
      autoStart = true,
    } = params;

    const strategyFactory = STRATEGY_REGISTRY[strategyName];
    if (!strategyFactory) {
      throw new Error(
        `Unknown strategy: ${strategyName}. Available: ${Object.keys(STRATEGY_REGISTRY).join(", ")}`,
      );
    }

    const strategy = strategyFactory();
    const agent = new Agent(
      { name, walletId, strategy, strategyConfig, tickIntervalMs },
      this.walletService,
      this.swapClient,
      this.eventBus,
    );

    this.agents.set(agent.id, agent);

    this.eventBus.emitAgentEvent("spawned", agent.id, {
      name,
      strategy: strategyName,
      walletId,
    });

    if (autoStart) {
      await agent.start();
    }

    return agent;
  }

  /**
   * Get an agent by ID.
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * List all agents with their current status.
   */
  listAgents() {
    return Array.from(this.agents.values()).map((a) => a.getInfo());
  }

  /**
   * Stop and remove an agent.
   */
  async removeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      await agent.stop();
      this.agents.delete(agentId);
    }
  }

  /**
   * Stop all agents.
   */
  async stopAll(): Promise<void> {
    for (const agent of this.agents.values()) {
      await agent.stop();
    }
  }

  /**
   * Subscribe to all agent events.
   */
  onEvent(listener: (event: AgentEvent) => void): () => void {
    this.eventBus.on("agent:event", listener);
    return () => this.eventBus.off("agent:event", listener);
  }

  /**
   * Get available strategy names.
   */
  getAvailableStrategies(): string[] {
    return Object.keys(STRATEGY_REGISTRY);
  }

  /**
   * Register a custom strategy.
   */
  registerStrategy(name: string, factory: () => IAgentStrategy): void {
    STRATEGY_REGISTRY[name] = factory;
  }
}
