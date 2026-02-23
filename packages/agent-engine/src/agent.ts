import { v4 as uuidv4 } from "uuid";
import type {
  IAgentStrategy,
  StrategyContext,
  StrategyResult,
} from "./strategies/base.js";
import type { WalletService, ISwapClient } from "@agentic-wallet/core";
import { EventBus } from "./event-bus.js";

export enum AgentStatus {
  Idle = "idle",
  Running = "running",
  Paused = "paused",
  Stopped = "stopped",
  Error = "error",
}

export interface AgentConfig {
  id?: string;
  name: string;
  walletId: string;
  strategy: IAgentStrategy;
  strategyConfig: Record<string, unknown>;
  tickIntervalMs: number;
}

/**
 * An Agent is an autonomous entity that owns a wallet
 * and executes a strategy on a periodic tick.
 */
export class Agent {
  readonly id: string;
  readonly name: string;
  readonly walletId: string;

  private strategy: IAgentStrategy;
  private strategyConfig: Record<string, unknown>;
  private tickIntervalMs: number;
  private status: AgentStatus = AgentStatus.Idle;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private walletService: WalletService;
  private swapClient: ISwapClient;
  private eventBus: EventBus;
  private executionLog: StrategyResult[] = [];
  private tickCount = 0;

  constructor(
    config: AgentConfig,
    walletService: WalletService,
    swapClient: ISwapClient,
    eventBus: EventBus,
  ) {
    this.id = config.id || uuidv4();
    this.name = config.name;
    this.walletId = config.walletId;
    this.strategy = config.strategy;
    this.strategyConfig = config.strategyConfig;
    this.tickIntervalMs = config.tickIntervalMs;
    this.walletService = walletService;
    this.swapClient = swapClient;
    this.eventBus = eventBus;
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  getExecutionLog(): StrategyResult[] {
    return [...this.executionLog];
  }

  getTickCount(): number {
    return this.tickCount;
  }

  getStrategyName(): string {
    return this.strategy.name;
  }

  getInfo() {
    return {
      id: this.id,
      name: this.name,
      walletId: this.walletId,
      strategy: this.strategy.name,
      status: this.status,
      tickCount: this.tickCount,
      tickIntervalMs: this.tickIntervalMs,
      lastResult: this.executionLog[this.executionLog.length - 1] || null,
    };
  }

  /**
   * Start the agent's execution loop.
   */
  async start(): Promise<void> {
    if (this.status === AgentStatus.Running) return;

    const context = this.buildContext();
    if (this.strategy.setup) {
      await this.strategy.setup(context);
    }

    this.status = AgentStatus.Running;
    this.eventBus.emitAgentEvent("started", this.id, {
      name: this.name,
      strategy: this.strategy.name,
      walletId: this.walletId,
    });

    // Execute immediately, then on interval
    this.tick();
    this.tickTimer = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  /**
   * Pause the agent (stops ticking but can be resumed).
   */
  pause(): void {
    if (this.status !== AgentStatus.Running) return;
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.status = AgentStatus.Paused;
    this.eventBus.emitAgentEvent("paused", this.id, { name: this.name });
  }

  /**
   * Resume a paused agent.
   */
  resume(): void {
    if (this.status !== AgentStatus.Paused) return;
    this.status = AgentStatus.Running;
    this.tickTimer = setInterval(() => this.tick(), this.tickIntervalMs);
    this.eventBus.emitAgentEvent("resumed", this.id, { name: this.name });
  }

  /**
   * Stop the agent permanently.
   */
  async stop(): Promise<void> {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;

    const context = this.buildContext();
    if (this.strategy.teardown) {
      await this.strategy.teardown(context);
    }

    this.status = AgentStatus.Stopped;
    this.eventBus.emitAgentEvent("stopped", this.id, {
      name: this.name,
      totalTicks: this.tickCount,
    });
  }

  // --- Private ---

  private async tick(): Promise<void> {
    if (this.status !== AgentStatus.Running) return;

    this.tickCount++;
    const context = this.buildContext();

    try {
      const result = await this.strategy.execute(context);
      this.executionLog.push(result);

      // Keep last 100 entries
      if (this.executionLog.length > 100) {
        this.executionLog = this.executionLog.slice(-100);
      }

      this.eventBus.emitAgentEvent("tick", this.id, {
        tickCount: this.tickCount,
        result,
      });
    } catch (error: any) {
      this.status = AgentStatus.Error;
      this.eventBus.emitAgentEvent("error", this.id, {
        error: error.message,
        tickCount: this.tickCount,
      });
    }
  }

  private buildContext(): StrategyContext {
    return {
      walletId: this.walletId,
      walletService: this.walletService,
      swapClient: this.swapClient,
      config: this.strategyConfig,
    };
  }
}
