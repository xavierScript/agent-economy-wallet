import type { WalletService } from "@agentic-wallet/core";
import type { ISwapClient } from "@agentic-wallet/core";

/**
 * Interface that all agent strategies must implement.
 * Strategies define what an agent does during each execution tick.
 */
export interface IAgentStrategy {
  /** Strategy name */
  readonly name: string;
  /** Human-readable description */
  readonly description: string;

  /**
   * Called on each tick. The strategy decides what to do.
   * @returns A summary of actions taken (for logging/display)
   */
  execute(context: StrategyContext): Promise<StrategyResult>;

  /**
   * Called once when the agent starts. Use for initialization.
   */
  setup?(context: StrategyContext): Promise<void>;

  /**
   * Called when the agent stops. Use for cleanup.
   */
  teardown?(context: StrategyContext): Promise<void>;
}

export interface StrategyContext {
  walletId: string;
  walletService: WalletService;
  swapClient: ISwapClient;
  config: Record<string, unknown>;
}

export interface StrategyResult {
  success: boolean;
  action: string;
  details: Record<string, unknown>;
  txSignature?: string;
}
