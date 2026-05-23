// ================================================================
// Neural Arena — Event Bus
// ================================================================
// The central nervous system of the simulation.
// Everything that happens is an immutable event.
// ================================================================

export enum SimulationEvent {
  // Lifecycle
  RUNTIME_BOOTED = 'RUNTIME_BOOTED',
  SIMULATION_STARTED = 'SIMULATION_STARTED',
  SIMULATION_PAUSED = 'SIMULATION_PAUSED',
  SIMULATION_STOPPED = 'SIMULATION_STOPPED',
  TICK = 'TICK',
  TICK_BUDGET_EXCEEDED = 'TICK_BUDGET_EXCEEDED',
  EVENT_REPLAYED = 'EVENT_REPLAYED',
  REPLAY_RESTORED = 'REPLAY_RESTORED',

  // World State
  WORLD_STATE_UPDATED = 'WORLD_STATE_UPDATED',
  WORLD_WAITING_FOR_INTENT = 'WORLD_WAITING_FOR_INTENT',
  STATE_BRANCH_CREATED = 'STATE_BRANCH_CREATED',
  CAUSALITY_VALIDATED = 'CAUSALITY_VALIDATED',
  CAUSALITY_VIOLATION = 'CAUSALITY_VIOLATION',

  // Agents
  AGENT_THINKING = 'AGENT_THINKING',
  AGENT_INTENT_SUBMITTED = 'AGENT_INTENT_SUBMITTED',
  AGENT_ERROR = 'AGENT_ERROR',
  AGENT_LIFECYCLE_UPDATED = 'AGENT_LIFECYCLE_UPDATED',
  AGENT_THINK_SUPPRESSED = 'AGENT_THINK_SUPPRESSED',
  PROMPT_STRATEGY_SELECTED = 'PROMPT_STRATEGY_SELECTED',
  COGNITIVE_CORRECTION_APPLIED = 'COGNITIVE_CORRECTION_APPLIED',
  PROMPT_ESCALATION_LEVEL_CHANGED = 'PROMPT_ESCALATION_LEVEL_CHANGED',
  ILLEGAL_MOVE_PATTERN_DETECTED = 'ILLEGAL_MOVE_PATTERN_DETECTED',
  CONTEXT_COMPILED = 'CONTEXT_COMPILED',
  MEMORY_BLOCK_INJECTED = 'MEMORY_BLOCK_INJECTED',
  PERSONA_BLOCK_INJECTED = 'PERSONA_BLOCK_INJECTED',
  CONSTRAINT_BLOCK_INJECTED = 'CONSTRAINT_BLOCK_INJECTED',
  COGNITIVE_GRAPH_TRANSITION = 'COGNITIVE_GRAPH_TRANSITION',
  FSM_NODE_EXECUTED = 'FSM_NODE_EXECUTED',

  // Rules / Physics
  INTENT_ACCEPTED = 'INTENT_ACCEPTED',
  INTENT_REJECTED = 'INTENT_REJECTED',
  INTENT_STALE_REJECTED = 'INTENT_STALE_REJECTED',
  INTENT_EXPIRED = 'INTENT_EXPIRED',
  INTENT_SUPERSEDED = 'INTENT_SUPERSEDED',
  INTENT_LIFECYCLE_UPDATED = 'INTENT_LIFECYCLE_UPDATED',
  MATCH_OVER = 'MATCH_OVER',

  // Provider / Network
  API_REQUEST_START = 'API_REQUEST_START',
  API_RESPONSE_RECEIVED = 'API_RESPONSE_RECEIVED',
  PROVIDER_OVERLOADED = 'PROVIDER_OVERLOADED',
  PROVIDER_CAPABILITY_LOOKUP = 'PROVIDER_CAPABILITY_LOOKUP',
  PROVIDER_ADAPTATION = 'PROVIDER_ADAPTATION',
  PROVIDER_PROMPT_TRANSFORMED = 'PROVIDER_PROMPT_TRANSFORMED',
  PROVIDER_FALLBACK_ACTIVATED = 'PROVIDER_FALLBACK_ACTIVATED',
  PROVIDER_UNSUPPORTED_FEATURE_HANDLED = 'PROVIDER_UNSUPPORTED_FEATURE_HANDLED',
  PROVIDER_COMPATIBILITY_DECISION = 'PROVIDER_COMPATIBILITY_DECISION',
  ANTICHEAT_PASS = 'ANTICHEAT_PASS',
  ANTICHEAT_FAIL = 'ANTICHEAT_FAIL',
  NORMALIZATION_RECOVERY = 'NORMALIZATION_RECOVERY',
}

export interface SimulationEventPayload {
  readonly eventId: string;          // Deterministic monotonic ID
  readonly sequence: number;         // Monotonic numeric order
  readonly type: SimulationEvent;
  readonly tick: number;             // Simulation tick when emitted
  readonly simulationTimeMs: number; // Deterministic sim time
  readonly wallTimestampMs: number;  // Wall-clock (observability only)
  readonly causedByEventId: string | null; // Causality edge
  readonly data: Readonly<Record<string, any>>;
  readonly version: number;          // Schema version for forward-compat
}

// Keep the old EventPayload interface around temporarily for backward compatibility
// with legacy components until they are all updated.
export interface EventPayload {
  eventId?: string;
  sequence?: number;
  type: SimulationEvent;
  timestamp: number;
  tick: number;
  data: Record<string, any>;
}

type EventHandler = (payload: SimulationEventPayload | EventPayload) => void;

import { EventStore } from './EventStore';

export class EventBus {
  private handlers: Map<SimulationEvent, EventHandler[]> = new Map();
  private globalHandlers: EventHandler[] = [];
  private eventStore: EventStore = new EventStore();

  subscribe(type: SimulationEvent, handler: EventHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  subscribeAll(handler: EventHandler): void {
    this.globalHandlers.push(handler);
  }

  /**
   * Emit an event.
   * Note: The tick parameter is kept for backward compatibility, but in Phase 2
   * the EventBus actually receives all context (simulationTimeMs, wallTimestampMs).
   * For legacy calls, we'll fake the missing fields until the callers are updated.
   */
  emit(
    type: SimulationEvent,
    tick: number,
    data: Record<string, any> = {},
    simulationTimeMs: number = 0,
    wallTimestampMs: number = Date.now(),
    causedByEventId: string | null = null,
  ): SimulationEventPayload {
    const payload = this.eventStore.append(type, tick, simulationTimeMs, wallTimestampMs, data, 1, causedByEventId);

    const handlers = this.handlers.get(type) || [];
    for (const handler of handlers) {
      try {
        // Also provide backward compatibility by duck-typing the old EventPayload structure
        // for legacy handlers that expect `payload.timestamp` instead of `payload.wallTimestampMs`.
        const compatPayload = {
          ...payload,
          timestamp: payload.wallTimestampMs,
        } as unknown as SimulationEventPayload;
        handler(compatPayload);
      } catch (err) {
        console.error(`[EventBus] Error in handler for ${type}:`, err);
      }
    }

    for (const handler of this.globalHandlers) {
      try {
        const compatPayload = {
          ...payload,
          timestamp: payload.wallTimestampMs,
        } as unknown as SimulationEventPayload;
        handler(compatPayload);
      } catch (err) {
        console.error(`[EventBus] Error in global handler for ${type}:`, err);
      }
    }

    return payload;
  }

  getStore(): EventStore {
    return this.eventStore;
  }

  restoreStore(snapshotJson: string, tick: number = 0, simulationTimeMs: number = 0, wallTimestampMs: number = Date.now()): SimulationEventPayload {
    this.eventStore.restore(snapshotJson);
    return this.emit(SimulationEvent.REPLAY_RESTORED, tick, {
      restoredEventCount: this.eventStore.size(),
      lastEventId: this.eventStore.getLastEventId(),
      lastSequence: this.eventStore.getLastSequence(),
    }, simulationTimeMs, wallTimestampMs);
  }

  replayStoredEvents(wallTimestampMs: number = Date.now()): void {
    const history = this.eventStore.getHistory();
    for (const event of history) {
      if (event.type === SimulationEvent.EVENT_REPLAYED || event.type === SimulationEvent.REPLAY_RESTORED) {
        continue;
      }

      this.emit(SimulationEvent.EVENT_REPLAYED, event.tick, {
        replayedEventId: event.eventId,
        replayedSequence: event.sequence,
        replayedType: event.type,
      }, event.simulationTimeMs, wallTimestampMs, event.eventId);
    }
  }

  /**
   * @deprecated Use getStore().getHistory()
   */
  getHistory(): EventPayload[] {
    return this.eventStore.getHistory() as unknown as EventPayload[];
  }
}
