import EventEmitter from "eventemitter3";

/**
 * An event emitted by the agent system.
 */
export interface AgentEvent {
  type: string;
  agentId: string;
  walletId?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Central event bus for the agent system.
 * Dashboard and CLI subscribe here for real-time updates.
 */
export class EventBus extends EventEmitter {
  override emit(event: string | symbol, data: AgentEvent): boolean {
    return super.emit(event, data);
  }

  emitAgentEvent(
    type: string,
    agentId: string,
    data: Record<string, unknown> = {},
  ): void {
    const event: AgentEvent = {
      type,
      agentId,
      timestamp: new Date().toISOString(),
      data,
    };
    this.emit("agent:event", event);
    this.emit(`agent:${type}`, event);
  }
}
