// ================================================================
// Neural Arena - Battlefield World
// ================================================================
// Authoritative simulation environment for a Battlefield plugin.
// Agents never mutate state; they answer causal world requests with
// intents that the world validates against the current state node.
// ================================================================

import { World } from '../engine/World';
import { EventBus, SimulationEvent, SimulationEventPayload } from '../engine/EventBus';
import { IntentGateway } from '../engine/IntentGateway';
import { IntentStatus, IntentType, ValidatedIntent } from '../engine/IntentValidator';
import { formatDeterministicId } from '../engine/DeterministicIds';
import { Battlefield } from './Battlefield';

interface ActiveIntentRequest {
  requestId: string;
  sourceEventId: string;
  agentIndex: number;
  turnNumber: number;
  originTick: number;
  stateNodeId: string;
  stateHash: string;
}

interface CausalityCheck {
  valid: boolean;
  status: IntentStatus.STALE | IntentStatus.EXPIRED | IntentStatus.REJECTED;
  reason: string;
}

export class BattlefieldWorld extends World {
  private battlefield: Battlefield;
  private currentAgentIndex: number = 0;
  private maxAgents: number = 2; // Default for chess
  private isWaitingForIntent: boolean = false;
  private activeRequest: ActiveIntentRequest | null = null;
  private nextRequestSequence: number = 1;
  private turnNumber: number = 1;

  constructor(eventBus: EventBus, intentGateway: IntentGateway, battlefield: Battlefield) {
    super(eventBus, intentGateway);
    this.battlefield = battlefield;
  }

  initialize(originEvent: SimulationEventPayload): void {
    const initialState = this.battlefield.initialize();
    this.currentAgentIndex = this.getActiveAgentIndex(initialState);
    this.turnNumber = 1;

    const transition = this.transitionState(initialState, 0, originEvent.eventId, {
      transitionType: 'INIT',
      turnNumber: this.turnNumber,
    });

    this.requestIntent(0, transition.event.eventId);
  }

  getState(): Record<string, any> {
    const currentState = this.getCurrentState();
    if (!currentState) return {};
    return this.battlefield.serializeState(currentState);
  }

  processTick(tick: number): void {
    const currentState = this.getCurrentState();
    if (!currentState) return;

    if (this.battlefield.isTerminal(currentState)) {
      return;
    }

    if (!this.intentGateway.hasPending()) {
      return;
    }

    const intents = this.intentGateway.drain();

    for (let i = 0; i < intents.length; i++) {
      const intent = intents[i];
      const causality = this.validateIntentCausality(intent);

      if (!causality.valid) {
        this.rejectIntentForCausality(intent, tick, causality);
        continue;
      }

      this.emitEvent(SimulationEvent.CAUSALITY_VALIDATED, tick, {
        intentId: intent.intentId,
        requestId: intent.requestId,
        agentIndex: intent.agentIndex,
        turnNumber: intent.turnNumber,
        stateNodeId: intent.stateNodeId,
        stateHash: intent.stateHash,
      }, intent.sourceEventId);

      if (intent.type === IntentType.SUBMIT_ACTION) {
        const accepted = this.processActionIntent(intent, tick);
        if (accepted) {
          this.supersedeRemainingIntents(intents.slice(i + 1), tick, accepted.eventId, intent.intentId);
          return;
        }
      } else if (intent.type === IntentType.FORFEIT) {
        const acceptedEvent = this.emitEvent(SimulationEvent.INTENT_ACCEPTED, tick, {
          intentId: intent.intentId,
          requestId: intent.requestId,
          agentIndex: this.currentAgentIndex,
          action: intent.type,
          reason: intent.payload.reason,
        }, intent.sourceEventId);

        this.markIntentStatus(intent, IntentStatus.ACCEPTED, tick, acceptedEvent.eventId);
        this.activeRequest = null;
        this.isWaitingForIntent = false;

        this.emitEvent(SimulationEvent.MATCH_OVER, tick, {
          result: {
            winner: this.currentAgentIndex === 0 ? 1 : 0,
            reason: `Agent forfeited: ${intent.payload.reason}`,
            isDraw: false,
          },
        }, acceptedEvent.eventId);

        this.supersedeRemainingIntents(intents.slice(i + 1), tick, acceptedEvent.eventId, intent.intentId);
        return;
      } else if (intent.type === IntentType.API_ERROR) {
        this.rejectIntent(intent, tick, intent.payload.error || 'API Error', intent.sourceEventId);
      } else {
        this.rejectIntent(intent, tick, `Unsupported intent type: ${intent.type}`, intent.sourceEventId);
      }
    }
  }

  private requestIntent(tick: number, causedByEventId: string): void {
    const currentState = this.getCurrentState();
    const currentNode = this.stateTree.getCurrentNode();
    if (!currentState || !currentNode) return;

    this.currentAgentIndex = this.getActiveAgentIndex(currentState);
    this.isWaitingForIntent = true;

    const requestId = formatDeterministicId('request', this.nextRequestSequence++);
    const legalActions = this.battlefield.getLegalActions(currentState);
    const prompt = this.battlefield.formatPrompt(currentState, legalActions);
    const requestData = {
      requestId,
      agentIndex: this.currentAgentIndex,
      turnNumber: this.turnNumber,
      originTick: tick,
      stateNodeId: currentNode.id,
      stateHash: currentNode.stateHash,
      legalActions,
      prompt,
    };

    const requestEvent = this.emitEvent(
      SimulationEvent.WORLD_WAITING_FOR_INTENT,
      tick,
      requestData,
      causedByEventId,
    );

    this.activeRequest = {
      requestId,
      sourceEventId: requestEvent.eventId,
      agentIndex: this.currentAgentIndex,
      turnNumber: this.turnNumber,
      originTick: tick,
      stateNodeId: currentNode.id,
      stateHash: currentNode.stateHash,
    };

    this.emitEvent(SimulationEvent.CAUSALITY_VALIDATED, tick, {
      requestId,
      sourceEventId: requestEvent.eventId,
      agentIndex: this.currentAgentIndex,
      turnNumber: this.turnNumber,
      stateNodeId: currentNode.id,
      stateHash: currentNode.stateHash,
      reason: 'Intent request anchored to current world state',
    }, requestEvent.eventId);
  }

  private processActionIntent(intent: ValidatedIntent, tick: number): SimulationEventPayload | null {
    const currentState = this.getCurrentState();
    if (!currentState) return null;

    const action = intent.payload.action;
    const validation = this.battlefield.validateAction(currentState, action);

    if (!validation.valid) {
      this.rejectIntent(intent, tick, validation.reason || 'Invalid action', intent.sourceEventId);
      return null;
    }

    const acceptedEvent = this.emitEvent(SimulationEvent.INTENT_ACCEPTED, tick, {
      intentId: intent.intentId,
      requestId: intent.requestId,
      agentIndex: this.currentAgentIndex,
      action,
      turnNumber: this.turnNumber,
      stateNodeId: intent.stateNodeId,
      stateHash: intent.stateHash,
    }, intent.sourceEventId);

    this.markIntentStatus(intent, IntentStatus.ACCEPTED, tick, acceptedEvent.eventId);

    const newState = this.battlefield.applyAction(currentState, action);
    const transition = this.transitionState(newState, tick, acceptedEvent.eventId, {
      transitionType: 'ACTION_APPLIED',
      agentIndex: this.currentAgentIndex,
      turnNumber: this.turnNumber,
      action,
      intentId: intent.intentId,
      requestId: intent.requestId,
    });

    this.activeRequest = null;
    this.isWaitingForIntent = false;

    if (this.battlefield.isTerminal(newState)) {
      this.emitEvent(SimulationEvent.MATCH_OVER, tick, {
        result: this.battlefield.getResult(newState),
      }, transition.event.eventId);
    } else {
      this.turnNumber++;
      this.currentAgentIndex = this.getActiveAgentIndex(newState);
      this.requestIntent(tick, transition.event.eventId);
    }

    return acceptedEvent;
  }

  private rejectIntent(intent: ValidatedIntent, tick: number, reason: string, causedByEventId: string): void {
    const rejectedEvent = this.emitEvent(SimulationEvent.INTENT_REJECTED, tick, {
      intentId: intent.intentId,
      requestId: intent.requestId,
      agentIndex: this.currentAgentIndex,
      action: intent.payload.action || intent.type,
      reason,
      turnNumber: this.turnNumber,
    }, causedByEventId);

    this.markIntentStatus(intent, IntentStatus.REJECTED, tick, rejectedEvent.eventId, reason);
    this.requestIntent(tick, rejectedEvent.eventId);
  }

  private rejectIntentForCausality(intent: ValidatedIntent, tick: number, check: CausalityCheck): void {
    const violationEvent = this.emitEvent(SimulationEvent.CAUSALITY_VIOLATION, tick, {
      intentId: intent.intentId,
      requestId: intent.requestId,
      agentIndex: intent.agentIndex,
      status: check.status,
      reason: check.reason,
      expected: this.activeRequest,
      actual: {
        requestId: intent.requestId,
        sourceEventId: intent.sourceEventId,
        agentIndex: intent.agentIndex,
        turnNumber: intent.turnNumber,
        originTick: intent.originTick,
        stateNodeId: intent.stateNodeId,
        stateHash: intent.stateHash,
      },
    }, intent.sourceEventId === 'event-missing' ? null : intent.sourceEventId);

    const staleEventType = check.status === IntentStatus.EXPIRED
      ? SimulationEvent.INTENT_EXPIRED
      : SimulationEvent.INTENT_STALE_REJECTED;

    const staleEvent = this.emitEvent(staleEventType, tick, {
      intentId: intent.intentId,
      requestId: intent.requestId,
      agentIndex: intent.agentIndex,
      action: intent.payload.action || intent.type,
      reason: check.reason,
    }, violationEvent.eventId);

    this.markIntentStatus(intent, check.status, tick, staleEvent.eventId, check.reason);

    this.emitEvent(SimulationEvent.INTENT_REJECTED, tick, {
      intentId: intent.intentId,
      requestId: intent.requestId,
      agentIndex: intent.agentIndex,
      action: intent.payload.action || intent.type,
      reason: check.reason,
      stale: true,
    }, staleEvent.eventId);
  }

  private supersedeRemainingIntents(
    intents: ValidatedIntent[],
    tick: number,
    causedByEventId: string,
    acceptedIntentId: string,
  ): void {
    for (const intent of intents) {
      const event = this.emitEvent(SimulationEvent.INTENT_SUPERSEDED, tick, {
        intentId: intent.intentId,
        requestId: intent.requestId,
        agentIndex: intent.agentIndex,
        acceptedIntentId,
        reason: 'Another intent already advanced the authoritative world state',
      }, causedByEventId);

      this.markIntentStatus(
        intent,
        IntentStatus.SUPERSEDED,
        tick,
        event.eventId,
        'Another intent already advanced the authoritative world state',
      );
    }
  }

  private markIntentStatus(
    intent: ValidatedIntent,
    status: IntentStatus,
    tick: number,
    statusEventId: string,
    reason?: string,
  ): void {
    this.intentGateway.updateStatus(intent.intentId, status, tick, statusEventId, reason);
    this.emitEvent(SimulationEvent.INTENT_LIFECYCLE_UPDATED, tick, {
      intentId: intent.intentId,
      requestId: intent.requestId,
      from: intent.status,
      to: status,
      reason,
      statusEventId,
    }, statusEventId);
  }

  private validateIntentCausality(intent: ValidatedIntent): CausalityCheck {
    const currentNode = this.stateTree.getCurrentNode();

    if (!this.activeRequest) {
      return {
        valid: false,
        status: IntentStatus.EXPIRED,
        reason: 'No active world intent request exists',
      };
    }

    if (!currentNode) {
      return {
        valid: false,
        status: IntentStatus.EXPIRED,
        reason: 'No current world state node exists',
      };
    }

    const expected = this.activeRequest;
    const checks: Array<[boolean, string]> = [
      [intent.requestId === expected.requestId, `request mismatch: expected ${expected.requestId}, got ${intent.requestId}`],
      [intent.sourceEventId === expected.sourceEventId, `source event mismatch: expected ${expected.sourceEventId}, got ${intent.sourceEventId}`],
      [intent.agentIndex === expected.agentIndex, `agent mismatch: expected ${expected.agentIndex}, got ${intent.agentIndex}`],
      [intent.turnNumber === expected.turnNumber, `turn mismatch: expected ${expected.turnNumber}, got ${intent.turnNumber}`],
      [intent.originTick === expected.originTick, `origin tick mismatch: expected ${expected.originTick}, got ${intent.originTick}`],
      [intent.stateNodeId === expected.stateNodeId, `state node mismatch: expected ${expected.stateNodeId}, got ${intent.stateNodeId}`],
      [intent.stateHash === expected.stateHash, `state hash mismatch: expected ${expected.stateHash}, got ${intent.stateHash}`],
      [intent.stateNodeId === currentNode.id, `current state node changed: expected ${intent.stateNodeId}, current ${currentNode.id}`],
      [intent.stateHash === currentNode.stateHash, `current state hash changed: expected ${intent.stateHash}, current ${currentNode.stateHash}`],
    ];

    for (const [passed, reason] of checks) {
      if (!passed) {
        return {
          valid: false,
          status: IntentStatus.STALE,
          reason,
        };
      }
    }

    return {
      valid: true,
      status: IntentStatus.REJECTED,
      reason: 'Intent causality is valid',
    };
  }

  private getActiveAgentIndex(state: any): number {
    if (typeof this.battlefield.getCurrentAgent === 'function') {
      return this.battlefield.getCurrentAgent(state);
    }

    return this.currentAgentIndex % this.maxAgents;
  }
}
