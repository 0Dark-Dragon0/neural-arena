// ================================================================
// Neural Arena — Abstract World
// ================================================================
// The authoritative source of truth.
// Applies physics/rules to intents and updates the environment.
// ================================================================

import { EventBus, SimulationEvent, SimulationEventPayload } from './EventBus';
import { IntentGateway } from './IntentGateway';
import { WorldStateTree, TransitionMetadata } from './WorldStateTree';

export interface StateTransitionResult {
  nodeId: string;
  stateHash: string;
  event: SimulationEventPayload;
}

export abstract class World<TState = any> {
  protected eventBus: EventBus;
  protected intentGateway: IntentGateway;
  public readonly stateTree: WorldStateTree<TState>;

  constructor(eventBus: EventBus, intentGateway: IntentGateway) {
    this.eventBus = eventBus;
    this.intentGateway = intentGateway;
    this.stateTree = new WorldStateTree<TState>();
  }

  /**
   * Called on every tick. The World should:
   * 1. Drain the intent queue.
   * 2. Validate intents against rules (anti-cheat, game logic).
   * 3. Update internal state by calling this.transitionState().
   */
  abstract processTick(tick: number): void;

  /**
   * Boot the world and set initial state.
   */
  abstract initialize(originEvent: SimulationEventPayload): void;

  /**
   * State transitions must go through the state tree.
   * This pushes a new immutable node and emits a WORLD_STATE_UPDATED event.
   */
  protected transitionState(
    newState: TState,
    tick: number,
    originEventId: string,
    metadata: TransitionMetadata
  ): StateTransitionResult {
    const nodeId = this.stateTree.pushState(newState, tick, originEventId, {
      ...metadata,
      sourceEventId: originEventId,
    });
    const node = this.stateTree.getNode(nodeId);
    
    const event = this.emitEvent(SimulationEvent.WORLD_STATE_UPDATED, tick, {
      state: newState,
      nodeId,
      stateHash: node?.stateHash,
      metadata,
      originEventId,
    }, originEventId);

    return {
      nodeId,
      stateHash: node?.stateHash || '',
      event,
    };
  }

  /**
   * Get the current state from the state tree.
   */
  getCurrentState(): Readonly<TState> | null {
    return this.stateTree.getCurrentState();
  }

  /**
   * Helper to return serialized environment state (often same as getCurrentState).
   */
  getState(): Readonly<TState> | null {
    return this.getCurrentState();
  }

  protected emitEvent(
    type: SimulationEvent,
    tick: number,
    data: Record<string, any> = {},
    causedByEventId: string | null = null,
  ): SimulationEventPayload {
    return this.eventBus.emit(
      type,
      tick,
      data,
      this.intentGateway.getSimulationTimeMs(),
      this.intentGateway.getWallTimestampMs(),
      causedByEventId,
    );
  }
}
