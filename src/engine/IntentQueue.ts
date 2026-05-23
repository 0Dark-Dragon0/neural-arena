// ================================================================
// Neural Arena — Intent Queue (LEGACY)
// ================================================================
// [LEGACY] Replaced by IntentGateway.ts in ACT I, Phase 4.
// Retained temporarily for backward compatibility.
// ================================================================

export interface AgentIntent {
  agentId: string;
  type: string;
  payload: Record<string, any>;
  timestamp: number;
}

export class IntentQueue {
  private queue: AgentIntent[] = [];

  submit(intent: AgentIntent): void {
    this.queue.push(intent);
  }

  hasPending(): boolean {
    return this.queue.length > 0;
  }

  drain(): AgentIntent[] {
    const current = [...this.queue];
    this.queue = [];
    return current;
  }
}
