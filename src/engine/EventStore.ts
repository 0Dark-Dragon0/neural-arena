// ================================================================
// Neural Arena — Event Store
// ================================================================
// Append-only immutable event log. This is the single source of
// truth for everything that happens in the simulation.
// ================================================================

import { SimulationEventPayload, SimulationEvent } from './EventBus';
import { EventSerializer } from './EventSerializer';
import { formatDeterministicId, parseDeterministicSequence } from './DeterministicIds';

export class EventStore {
  private events: SimulationEventPayload[] = [];
  private nextSequence: number = 1;

  /**
   * Append an event to the store.
   * Assigns a monotonic unique ID to the event and freezes the payload.
   */
  append(
    type: SimulationEvent,
    tick: number,
    simulationTimeMs: number,
    wallTimestampMs: number,
    data: Record<string, any>,
    version: number = 1,
    causedByEventId: string | null = null,
  ): SimulationEventPayload {
    const sequence = this.nextSequence++;
    const eventId = formatDeterministicId('event', sequence);

    const payload = this.freezeEvent({
      eventId,
      sequence,
      type,
      tick,
      simulationTimeMs,
      wallTimestampMs,
      causedByEventId,
      data: this.deepFreeze(this.deepClone(data)),
      version,
    });

    this.events.push(payload);
    return this.cloneEvent(payload);
  }

  /**
   * Retrieve a slice of events by sequence range.
   */
  getRange(fromSequence: number, toSequence: number): SimulationEventPayload[] {
    return this.events
      .filter(e => e.sequence >= fromSequence && e.sequence <= toSequence)
      .map(e => this.cloneEvent(e));
  }

  /**
   * Retrieve all events of a specific type.
   */
  getByType(type: SimulationEvent): SimulationEventPayload[] {
    return this.events.filter(e => e.type === type).map(e => this.cloneEvent(e));
  }

  /**
   * Get the entire history.
   */
  getHistory(): SimulationEventPayload[] {
    return this.events.map(e => this.cloneEvent(e));
  }

  /**
   * Get the current sequence position (last event ID).
   */
  getLastEventId(): string | null {
    return this.events.length > 0 ? this.events[this.events.length - 1].eventId : null;
  }

  getLastSequence(): number {
    return this.nextSequence > 1 ? this.nextSequence - 1 : 0;
  }

  /**
   * Total number of events in the store.
   */
  size(): number {
    return this.events.length;
  }

  /**
   * Serialize the entire store to a JSON string.
   */
  snapshot(): string {
    return EventSerializer.serialize(this.events);
  }

  /**
   * Restore the store from a snapshot, overwriting current history.
   */
  restore(snapshotJson: string): void {
    const restored = EventSerializer.deserialize(snapshotJson);
    this.events = restored.map((event, index) => this.normalizeRestoredEvent(event, index));
    const maxSequence = this.events.reduce((max, event) => Math.max(max, event.sequence), 0);
    this.nextSequence = maxSequence + 1;
  }

  private normalizeRestoredEvent(event: any, index: number): SimulationEventPayload {
    const parsedSequence = event.sequence ?? parseDeterministicSequence(event.eventId, 'event');
    const sequence = typeof parsedSequence === 'number' && Number.isFinite(parsedSequence)
      ? parsedSequence
      : index + 1;

    return this.freezeEvent({
      eventId: typeof event.eventId === 'string'
        ? event.eventId
        : formatDeterministicId('event', sequence),
      sequence,
      type: event.type,
      tick: event.tick,
      simulationTimeMs: event.simulationTimeMs ?? 0,
      wallTimestampMs: event.wallTimestampMs ?? event.timestamp ?? 0,
      causedByEventId: event.causedByEventId ?? null,
      data: this.deepFreeze(this.deepClone(event.data ?? {})),
      version: event.version ?? 1,
    });
  }

  private cloneEvent(event: SimulationEventPayload): SimulationEventPayload {
    return this.freezeEvent({
      ...event,
      data: this.deepFreeze(this.deepClone(event.data)),
    });
  }

  private freezeEvent(event: SimulationEventPayload): SimulationEventPayload {
    return Object.freeze({
      ...event,
      data: this.deepFreeze(event.data),
    });
  }

  private deepClone<T>(value: T): T {
    if (value === null || typeof value !== 'object') return value;
    if (typeof value === 'bigint') return value;
    if (Array.isArray(value)) {
      return value.map(item => this.deepClone(item)) as T;
    }

    const cloned: Record<string, any> = {};
    for (const [key, nested] of Object.entries(value as Record<string, any>)) {
      cloned[key] = this.deepClone(nested);
    }
    return cloned as T;
  }

  private deepFreeze<T>(value: T): Readonly<T> {
    if (value === null || typeof value !== 'object') return value as Readonly<T>;

    for (const key of Object.keys(value as Record<string, any>)) {
      const nested = (value as Record<string, any>)[key];
      if (nested !== null && typeof nested === 'object') {
        this.deepFreeze(nested);
      }
    }

    return Object.freeze(value);
  }
}
