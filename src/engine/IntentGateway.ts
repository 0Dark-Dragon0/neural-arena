// ================================================================
// Neural Arena — Intent Gateway
// ================================================================
// The single entry point for all agent actions.
// Enforces schema validation, assigns priorities, and tracks
// intent lifecycle. Replaces the old IntentQueue.
// ================================================================

import { IntentValidator, RawIntent, ValidatedIntent, IntentStatus } from './IntentValidator';
import { EventBus, SimulationEvent } from './EventBus';
import { SimulationClock } from './SimulationClock';
import { formatDeterministicId } from './DeterministicIds';

export class IntentGateway {
  private pendingQueue: ValidatedIntent[] = [];
  private history: ValidatedIntent[] = [];
  private latestById: Map<string, ValidatedIntent> = new Map();
  private nextIntentSequence: number = 1;
  private eventBus: EventBus;
  private clock: SimulationClock;

  constructor(eventBus: EventBus, clock: SimulationClock) {
    this.eventBus = eventBus;
    this.clock = clock;
  }

  /**
   * Submit a raw intent. Validates it before adding to the queue.
   */
  submit(raw: RawIntent): string {
    const sequence = this.nextIntentSequence++;
    const intentId = formatDeterministicId('intent', sequence);
    const currentTick = this.clock.getTick();

    try {
      const validated = Object.freeze(IntentValidator.validate(raw, currentTick, intentId, sequence));
      this.pendingQueue.push(validated);
      this.history.push(validated);
      this.latestById.set(intentId, validated);

      this.sortPendingQueue();

      return intentId;
    } catch (error: any) {
      // Validation failed. Emit an error and do not queue.
      this.eventBus.emit(SimulationEvent.AGENT_ERROR, currentTick, {
        agentId: raw.agentId,
        error: `Intent Validation Failed: ${error.message}`,
        rawIntent: raw,
      }, this.getSimulationTimeMs(), this.getWallTimestampMs());
      throw error;
    }
  }

  /**
   * Check if there are any pending intents.
   */
  hasPending(): boolean {
    return this.pendingQueue.length > 0;
  }

  /**
   * Drain all pending intents for processing by the World.
   */
  drain(): ValidatedIntent[] {
    const intents = [...this.pendingQueue];
    this.pendingQueue = [];
    return intents;
  }

  /**
   * Update the status of an intent after World processing.
   */
  updateStatus(intentId: string, status: IntentStatus, tick: number, statusEventId: string | null, reason?: string): ValidatedIntent | null {
    const current = this.latestById.get(intentId);
    if (!current) return null;

    const updated = Object.freeze({
      ...current,
      status,
      statusUpdatedAtTick: tick,
      statusEventId,
      ...(reason ? { statusReason: reason } : {}),
    });

    this.latestById.set(intentId, updated);
    this.history.push(updated);
    this.pendingQueue = this.pendingQueue.map(intent => intent.intentId === intentId ? updated : intent);
    return updated;
  }

  getHistory(): ValidatedIntent[] {
    return [...this.history];
  }

  getLatest(intentId: string): ValidatedIntent | null {
    return this.latestById.get(intentId) || null;
  }

  getCurrentTick(): number {
    return this.clock.getTick();
  }

  getSimulationTimeMs(): number {
    return this.clock.getSimulationTimeMs();
  }

  getWallTimestampMs(): number {
    return Number(this.clock.getWallTimeNs() / 1_000_000n);
  }

  private sortPendingQueue(): void {
    this.pendingQueue.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (a.originTick !== b.originTick) return a.originTick - b.originTick;
      const requestCompare = a.requestId.localeCompare(b.requestId);
      if (requestCompare !== 0) return requestCompare;
      if (a.agentIndex !== b.agentIndex) return a.agentIndex - b.agentIndex;
      return a.sequence - b.sequence;
    });
  }
}
