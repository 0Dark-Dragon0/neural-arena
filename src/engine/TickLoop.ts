// ================================================================
// Neural Arena — Tick Loop (LEGACY)
// ================================================================
// [LEGACY] Replaced by TickScheduler.ts in ACT I.
// Retained for backward compatibility and regression testing.
// ================================================================
import { SimulationClock } from './SimulationClock';
import { EventBus, SimulationEvent } from './EventBus';
import { World } from './World';

export class TickLoop {
  private clock: SimulationClock;
  private eventBus: EventBus;
  private world: World;
  private tickRateMs: number;
  private intervalId?: NodeJS.Timeout;

  constructor(clock: SimulationClock, eventBus: EventBus, world: World, tickRateMs: number = 100) {
    this.clock = clock;
    this.eventBus = eventBus;
    this.world = world;
    this.tickRateMs = tickRateMs;
  }

  start() {
    this.clock.start();
    const startedEvent = this.eventBus.emit(SimulationEvent.SIMULATION_STARTED, 0);
    this.world.initialize(startedEvent);

    this.intervalId = setInterval(() => {
      this.tick();
    }, this.tickRateMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.clock.pause();
    this.eventBus.emit(SimulationEvent.SIMULATION_STOPPED, this.clock.getTick());
  }

  private tick() {
    const currentTick = this.clock.advanceTick();
    
    // Process World intents and physics
    this.world.processTick(currentTick);

    // Broadcast tick event so agents can update their internal states/timeouts
    this.eventBus.emit(SimulationEvent.TICK, currentTick, {
      elapsedMs: this.clock.getSimulationTimeMs(),
    });
  }
}
