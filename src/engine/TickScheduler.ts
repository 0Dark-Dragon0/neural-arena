// ================================================================
// Neural Arena — Tick Scheduler
// ================================================================
// The deterministic tick scheduler for the simulation runtime.
// Replaces TickLoop.ts with drift-compensating scheduling.
//
// DESIGN:
//   Uses setTimeout with per-tick correction instead of setInterval.
//   After each tick, measures processing duration and subtracts it
//   from the tick rate to determine the sleep interval. This prevents
//   cumulative drift under load.
//
//   If tick processing exceeds the tick rate, the scheduler enters
//   "catch-up mode" (zero sleep) and emits a TICK_BUDGET_EXCEEDED
//   event for observability.
//
// DETERMINISM:
//   The scheduler drives the SimulationClock, which owns simulation
//   time. The scheduler itself only uses wall-clock reads for sleep
//   calculation (an inherently non-deterministic operation). All
//   simulation state transitions flow through the clock's
//   deterministic advanceTick().
//
// FUTURE SCALABILITY:
//   Variable tick rates are supported — the scheduler reads the
//   tick rate from the clock on every iteration, allowing runtime
//   changes (slow-motion, fast-forward, per-battlefield rates).
// ================================================================

import { SimulationClock } from './SimulationClock';
import { EventBus, SimulationEvent } from './EventBus';
import { World } from './World';

/**
 * Observability statistics for the tick scheduler.
 */
export interface SchedulerStats {
  readonly totalTicksProcessed: number;
  readonly totalDriftMs: number;
  readonly maxSingleTickDriftMs: number;
  readonly avgTickProcessingMs: number;
  readonly budgetExceededCount: number;
  readonly isRunning: boolean;
}

export class TickScheduler {
  private clock: SimulationClock;
  private eventBus: EventBus;
  private world: World;
  private _isRunning: boolean = false;
  private timeoutId?: ReturnType<typeof setTimeout>;

  // ── Drift Tracking (Observability) ─────────────────────────────
  private _totalTicksProcessed: number = 0;
  private _totalProcessingNs: bigint = 0n;
  private _totalDriftNs: bigint = 0n;
  private _maxSingleTickDriftNs: bigint = 0n;
  private _budgetExceededCount: number = 0;

  constructor(clock: SimulationClock, eventBus: EventBus, world: World) {
    this.clock = clock;
    this.eventBus = eventBus;
    this.world = world;
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  /**
   * Start the simulation tick loop.
   * 1. Starts the clock (resets simulation time to 0).
   * 2. Emits SIMULATION_STARTED.
   * 3. Initializes the world (creates initial game state).
   * 4. Begins the self-correcting tick loop.
   */
  start(): void {
    if (this._isRunning) return;

    this._isRunning = true;
    this.resetStats();
    this.clock.start();

    const startedEvent = this.eventBus.emit(SimulationEvent.SIMULATION_STARTED, 0, {
      tickRateMs: this.clock.getTickRateMs(),
    }, this.clock.getSimulationTimeMs(), Number(this.clock.getWallTimeNs() / 1_000_000n));

    // Initialize the world — this creates the initial game state
    // and emits the first WORLD_STATE_UPDATED event.
    this.world.initialize(startedEvent);

    // Begin the tick loop
    this.scheduleNextTick();
  }

  /**
   * Stop the simulation tick loop.
   * Cleans up the scheduled timeout and pauses the clock.
   */
  stop(): void {
    if (!this._isRunning) return;

    this._isRunning = false;

    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    this.clock.pause();

    this.eventBus.emit(SimulationEvent.SIMULATION_STOPPED, this.clock.getTick(), {
      stats: this.getStats(),
    }, this.clock.getSimulationTimeMs(), Number(this.clock.getWallTimeNs() / 1_000_000n));
  }

  /**
   * Pause the simulation. Clock pauses, tick loop suspends.
   */
  pause(): void {
    if (!this._isRunning) return;

    this._isRunning = false;

    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    this.clock.pause();

    this.eventBus.emit(SimulationEvent.SIMULATION_PAUSED, this.clock.getTick(), {
      stats: this.getStats(),
    }, this.clock.getSimulationTimeMs(), Number(this.clock.getWallTimeNs() / 1_000_000n));
  }

  /**
   * Resume the simulation after a pause.
   */
  resume(): void {
    if (this._isRunning) return;

    this._isRunning = true;
    this.clock.resume();
    this.scheduleNextTick();
  }

  // ── Core Tick Loop ─────────────────────────────────────────────

  /**
   * Schedule the next tick with drift compensation.
   *
   * ALGORITHM:
   *   1. Record wall-clock before tick processing.
   *   2. Process tick (synchronous: advance clock, update world, emit events).
   *   3. Record wall-clock after tick processing.
   *   4. Calculate processing duration.
   *   5. Sleep for max(0, tickRate - processingDuration).
   *   6. If processing exceeded tickRate, emit TICK_BUDGET_EXCEEDED.
   *
   * WHY setTimeout INSTEAD OF setInterval:
   *   setInterval fires at fixed intervals from the LAST callback start,
   *   not from when processing finishes. Under load, this causes callbacks
   *   to queue up and execute back-to-back, creating unpredictable timing.
   *   setTimeout with self-correction ensures each tick gets the full
   *   processing budget minus actual elapsed time.
   */
  private scheduleNextTick(): void {
    if (!this._isRunning) return;

    // Read tick rate from clock (allows runtime changes)
    const tickRateMs = this.clock.getTickRateMs();
    const tickRateNs = BigInt(Math.round(tickRateMs * 1_000_000));

    // ── Wall-clock BEFORE tick processing ──
    const beforeNs = process.hrtime.bigint();

    // ── Process the tick (synchronous) ──
    this.processTick();

    // ── Wall-clock AFTER tick processing ──
    const afterNs = process.hrtime.bigint();
    const processingNs = afterNs - beforeNs;

    // ── Update drift statistics ──
    this._totalTicksProcessed++;
    this._totalProcessingNs += processingNs;

    // Calculate drift: how much processing exceeded the tick budget
    if (processingNs > tickRateNs) {
      const overageNs = processingNs - tickRateNs;
      this._totalDriftNs += overageNs;
      this._budgetExceededCount++;

      if (overageNs > this._maxSingleTickDriftNs) {
        this._maxSingleTickDriftNs = overageNs;
      }

      // Emit observability event for budget exceeded
      this.eventBus.emit(SimulationEvent.TICK_BUDGET_EXCEEDED, this.clock.getTick(), {
        processingMs: Number(processingNs / 1_000_000n),
        budgetMs: tickRateMs,
        overageMs: Number(overageNs / 1_000_000n),
      }, this.clock.getSimulationTimeMs(), Number(afterNs / 1_000_000n));
    }

    // ── Calculate sleep interval with correction ──
    const processingMs = Number(processingNs / 1_000_000n);
    const sleepMs = Math.max(0, tickRateMs - processingMs);

    // Schedule next tick
    this.timeoutId = setTimeout(() => this.scheduleNextTick(), sleepMs);
  }

  /**
   * Process a single simulation tick.
   *
   * ORDER OF OPERATIONS (deterministic):
   *   1. Advance the simulation clock (tick counter + simulation time).
   *   2. Let the World process pending intents and update state.
   *   3. Emit a TICK event with both simulation and wall-clock times.
   *
   * This ordering ensures that the World always sees the correct
   * simulation tick when processing intents, and subscribers receive
   * accurate timing data.
   */
  private processTick(): void {
    // 1. Advance deterministic simulation time
    const currentTick = this.clock.advanceTick();

    // 2. World processes intents and updates physics
    this.world.processTick(currentTick);

    // 3. Emit tick heartbeat event
    this.eventBus.emit(SimulationEvent.TICK, currentTick, {
      simulationTimeMs: this.clock.getSimulationTimeMs(),
      wallElapsedMs: this.clock.getWallElapsedMs(),
      tickRateMs: this.clock.getTickRateMs(),
    }, this.clock.getSimulationTimeMs(), Number(this.clock.getWallTimeNs() / 1_000_000n));
  }

  // ── Observability ──────────────────────────────────────────────

  /**
   * Get comprehensive scheduler statistics for telemetry.
   */
  getStats(): SchedulerStats {
    const avgProcessingNs = this._totalTicksProcessed > 0
      ? this._totalProcessingNs / BigInt(this._totalTicksProcessed)
      : 0n;

    return {
      totalTicksProcessed: this._totalTicksProcessed,
      totalDriftMs: Number(this._totalDriftNs / 1_000_000n),
      maxSingleTickDriftMs: Number(this._maxSingleTickDriftNs / 1_000_000n),
      avgTickProcessingMs: Number(avgProcessingNs / 1_000_000n),
      budgetExceededCount: this._budgetExceededCount,
      isRunning: this._isRunning,
    };
  }

  /** Whether the scheduler is currently running. */
  isRunning(): boolean {
    return this._isRunning;
  }

  /** Reset all drift tracking statistics. */
  private resetStats(): void {
    this._totalTicksProcessed = 0;
    this._totalProcessingNs = 0n;
    this._totalDriftNs = 0n;
    this._maxSingleTickDriftNs = 0n;
    this._budgetExceededCount = 0;
  }
}
