// ================================================================
// Neural Arena — Simulation Clock
// ================================================================
// The authoritative time source for the simulation runtime.
//
// CRITICAL DESIGN INVARIANT:
//   Simulation time is DETERMINISTIC. It is derived purely from
//   tick count × tick rate. It never reads from the system clock.
//   During replay, simulation time is perfectly reconstructable.
//
//   Wall-clock time is MONOTONIC (process.hrtime.bigint). It is
//   used ONLY for observability (latency tracking, drift detection).
//   It is NEVER used for simulation logic.
//
// These two time domains MUST remain completely separated.
// Any code that mixes them breaks determinism and replay.
// ================================================================

/**
 * Serializable snapshot of the clock's deterministic state.
 * This is everything needed to reconstruct simulation time during replay.
 * Wall-clock fields are intentionally excluded — they are ephemeral.
 */
export interface ClockSnapshot {
  readonly tick: number;
  readonly simulationTimeNs: string;   // BigInt serialized as string for JSON safety
  readonly tickRateNs: string;         // BigInt serialized as string
  readonly isPaused: boolean;
  readonly pausedAtTick: number;
}

/**
 * Runtime statistics for the clock. Observability only.
 */
export interface ClockStats {
  readonly tick: number;
  readonly simulationTimeMs: number;
  readonly wallElapsedMs: number;
  readonly tickRateMs: number;
  readonly isPaused: boolean;
  readonly pausedAtTick: number;
  readonly totalWallPauseMs: number;
}

export class SimulationClock {
  // ── Deterministic State (Replay-Safe) ──────────────────────────
  // These fields are the ONLY source of truth for simulation time.
  // They are fully serializable and reconstructable from a snapshot.
  private _tick: number = 0;
  private _simulationTimeNs: bigint = 0n;
  private _tickRateNs: bigint;
  private _isPaused: boolean = true;
  private _pausedAtTick: number = 0;

  // ── Wall-Clock State (Observability Only) ──────────────────────
  // These fields track real-world elapsed time using the monotonic
  // high-resolution timer. They are NEVER used in simulation logic.
  // They are NOT serialized or included in replay snapshots.
  private _wallStartNs: bigint = 0n;
  private _wallPauseStartNs: bigint = 0n;
  private _totalWallPauseDurationNs: bigint = 0n;

  /**
   * Create a new simulation clock.
   * @param tickRateMs Milliseconds per simulation tick. Default: 100ms.
   *                   Chess: 100ms. RTS: 10ms. Swarm: 1ms.
   */
  constructor(tickRateMs: number = 100) {
    if (tickRateMs <= 0) {
      throw new Error(`Invalid tick rate: ${tickRateMs}ms. Must be > 0.`);
    }
    this._tickRateNs = BigInt(Math.round(tickRateMs * 1_000_000));
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  /**
   * Start the clock. Records wall-clock start time for observability.
   * Simulation time starts at 0ns (deterministic).
   */
  start(): void {
    this._wallStartNs = process.hrtime.bigint();
    this._isPaused = false;
    this._tick = 0;
    this._simulationTimeNs = 0n;
  }

  /**
   * Pause the simulation clock. Wall-clock tracking continues
   * to accurately measure pause duration.
   */
  pause(): void {
    if (this._isPaused) return;
    this._wallPauseStartNs = process.hrtime.bigint();
    this._isPaused = true;
    this._pausedAtTick = this._tick;
  }

  /**
   * Resume the simulation clock after a pause.
   * Accumulated wall-clock pause duration is excluded from
   * wallElapsedMs calculations.
   */
  resume(): void {
    if (!this._isPaused) return;
    if (this._wallPauseStartNs > 0n) {
      const pauseDuration = process.hrtime.bigint() - this._wallPauseStartNs;
      this._totalWallPauseDurationNs += pauseDuration;
    }
    this._isPaused = false;
  }

  // ── Tick Advancement ───────────────────────────────────────────

  /**
   * Advance the simulation by exactly one tick.
   * This is the ONLY method that changes simulation time.
   *
   * DETERMINISTIC: simulation time increases by exactly tickRateNs.
   * No wall-clock reads occur here.
   *
   * @returns The new tick number.
   */
  advanceTick(): number {
    if (this._isPaused) return this._tick;
    this._tick++;
    this._simulationTimeNs += this._tickRateNs;
    return this._tick;
  }

  // ── Deterministic Reads (Simulation Logic) ─────────────────────

  /** Current simulation tick. Deterministic. */
  getTick(): number {
    return this._tick;
  }

  /**
   * Current simulation time in milliseconds.
   * DETERMINISTIC: derived purely from tick × tickRate.
   * Safe for simulation logic and replay.
   */
  getSimulationTimeMs(): number {
    return Number(this._simulationTimeNs / 1_000_000n);
  }

  /**
   * Current simulation time in nanoseconds.
   * DETERMINISTIC: derived purely from tick × tickRate.
   */
  getSimulationTimeNs(): bigint {
    return this._simulationTimeNs;
  }

  /** Current tick rate in milliseconds. */
  getTickRateMs(): number {
    return Number(this._tickRateNs / 1_000_000n);
  }

  /** Whether the clock is currently paused. */
  isPaused(): boolean {
    return this._isPaused;
  }

  /** Whether the clock is currently running (not paused). */
  isRunning(): boolean {
    return !this._isPaused;
  }

  // ── Wall-Clock Reads (Observability Only) ──────────────────────
  // WARNING: These methods read the real-world monotonic clock.
  // They MUST NOT be used in simulation logic, state transitions,
  // or any code path that must be deterministic/replayable.

  /**
   * Real-world elapsed time since clock start, excluding pause durations.
   * Uses monotonic high-resolution timer (never goes backward).
   * FOR OBSERVABILITY ONLY. Not deterministic. Not replayable.
   */
  getWallElapsedMs(): number {
    if (this._wallStartNs === 0n) return 0;
    const now = process.hrtime.bigint();
    const rawElapsed = now - this._wallStartNs;
    const activeElapsed = rawElapsed - this._totalWallPauseDurationNs;
    return Number(activeElapsed / 1_000_000n);
  }

  /**
   * Raw monotonic wall-clock reading in nanoseconds.
   * FOR OBSERVABILITY/SCHEDULING ONLY.
   */
  getWallTimeNs(): bigint {
    return process.hrtime.bigint();
  }

  // ── Configuration ──────────────────────────────────────────────

  /**
   * Change the tick rate. Takes effect on the next tick.
   * This allows per-battlefield and runtime-dynamic tick rates.
   *
   * @param ms New tick rate in milliseconds.
   */
  setTickRate(ms: number): void {
    if (ms <= 0) {
      throw new Error(`Invalid tick rate: ${ms}ms. Must be > 0.`);
    }
    this._tickRateNs = BigInt(Math.round(ms * 1_000_000));
  }

  // ── Serialization (Replay Support) ─────────────────────────────

  /**
   * Serialize the deterministic clock state for replay snapshots.
   * Wall-clock state is intentionally excluded.
   */
  snapshot(): ClockSnapshot {
    return Object.freeze({
      tick: this._tick,
      simulationTimeNs: this._simulationTimeNs.toString(),
      tickRateNs: this._tickRateNs.toString(),
      isPaused: this._isPaused,
      pausedAtTick: this._pausedAtTick,
    });
  }

  /**
   * Restore clock state from a replay snapshot.
   * Wall-clock state is reset (it has no meaning during replay).
   */
  restoreFromSnapshot(snapshot: ClockSnapshot): void {
    this._tick = snapshot.tick;
    this._simulationTimeNs = BigInt(snapshot.simulationTimeNs);
    this._tickRateNs = BigInt(snapshot.tickRateNs);
    this._isPaused = snapshot.isPaused;
    this._pausedAtTick = snapshot.pausedAtTick;

    // Reset wall-clock state — it's meaningless in a restored context
    this._wallStartNs = process.hrtime.bigint();
    this._wallPauseStartNs = 0n;
    this._totalWallPauseDurationNs = 0n;
  }

  /**
   * Create a new clock from a serialized snapshot.
   * Used for replay reconstruction.
   */
  static fromSnapshot(snapshot: ClockSnapshot): SimulationClock {
    const tickRateMs = Number(BigInt(snapshot.tickRateNs) / 1_000_000n);
    const clock = new SimulationClock(tickRateMs);
    clock.restoreFromSnapshot(snapshot);
    return clock;
  }

  // ── Observability ──────────────────────────────────────────────

  /**
   * Get comprehensive clock statistics for telemetry and debugging.
   */
  getStats(): ClockStats {
    return {
      tick: this._tick,
      simulationTimeMs: this.getSimulationTimeMs(),
      wallElapsedMs: this.getWallElapsedMs(),
      tickRateMs: this.getTickRateMs(),
      isPaused: this._isPaused,
      pausedAtTick: this._pausedAtTick,
      totalWallPauseMs: Number(this._totalWallPauseDurationNs / 1_000_000n),
    };
  }
}
