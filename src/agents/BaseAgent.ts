// ================================================================
// Neural Arena — Base Agent
// ================================================================

import { EventBus, SimulationEvent, EventPayload, SimulationEventPayload } from '../engine/EventBus';
import { IntentGateway } from '../engine/IntentGateway';
import { IntentCausalityContext } from '../engine/IntentValidator';

export abstract class BaseAgent {
  protected agentIndex: number;
  protected eventBus: EventBus;
  protected intentGateway: IntentGateway;

  constructor(agentIndex: number, eventBus: EventBus, intentGateway: IntentGateway) {
    this.agentIndex = agentIndex;
    this.eventBus = eventBus;
    this.intentGateway = intentGateway;
    this.subscribe();
  }

  private subscribe(): void {
    this.eventBus.subscribeAll((payload) => this.handleEvent(payload));
  }

  protected abstract handleEvent(payload: SimulationEventPayload | EventPayload): void;

  protected submitIntent(type: string, data: Record<string, any>, causality?: IntentCausalityContext): string {
    const intentId = this.intentGateway.submit({
      agentId: `agent_${this.agentIndex}`,
      type,
      payload: { ...data, agentIndex: this.agentIndex },
      causality,
    });

    this.eventBus.emit(
      SimulationEvent.AGENT_INTENT_SUBMITTED,
      this.intentGateway.getCurrentTick(),
      {
        agentIndex: this.agentIndex,
        intentId,
        intentType: type,
        requestId: causality?.requestId,
        sourceEventId: causality?.sourceEventId,
        turnNumber: causality?.turnNumber,
        stateNodeId: causality?.stateNodeId,
        stateHash: causality?.stateHash,
      },
      this.intentGateway.getSimulationTimeMs(),
      this.intentGateway.getWallTimestampMs(),
      causality?.sourceEventId ?? null,
    );

    return intentId;
  }
}
