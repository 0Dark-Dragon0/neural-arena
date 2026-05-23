// ================================================================
// Neural Arena — Event System
// ================================================================
// Simple typed pub/sub event emitter.
// The engine emits events; the CLI, recorder, and logger subscribe.
// ================================================================

import { EventType, GameEvent } from './types';

type EventHandler = (event: GameEvent) => void;

export class EventSystem {
  private handlers: Map<EventType, EventHandler[]> = new Map();
  private globalHandlers: EventHandler[] = [];

  /** Subscribe to a specific event type */
  on(type: EventType, handler: EventHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  /** Subscribe to ALL events */
  onAll(handler: EventHandler): void {
    this.globalHandlers.push(handler);
  }

  /** Emit an event to all subscribers */
  emit(type: EventType, data: Record<string, unknown> = {}): void {
    const event: GameEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    const handlers = this.handlers.get(type) || [];
    for (const handler of handlers) {
      handler(event);
    }

    for (const handler of this.globalHandlers) {
      handler(event);
    }
  }

  /** Remove all handlers (cleanup) */
  removeAll(): void {
    this.handlers.clear();
    this.globalHandlers = [];
  }
}
