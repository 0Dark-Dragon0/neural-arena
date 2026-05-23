// ================================================================
// Neural Arena — Provider Health Tracker
// ================================================================
// Tracks per-provider health metrics in real-time during matches.
// Classifies providers, adapts cooldowns, and detects overload.
//
// This is NOT a provider adapter. It's a behavioral observer that
// the orchestrator uses to make smarter pacing decisions.
// ================================================================

import { Logger } from './logger';

// ─── Provider Classification ─────────────────────────────────────

export enum ProviderStatus {
  HEALTHY     = 'HEALTHY',      // Normal operation
  SLOW        = 'SLOW',         // Responding but high latency
  OVERLOADED  = 'OVERLOADED',   // Receiving 429s
  UNSTABLE    = 'UNSTABLE',     // Mixed success/failure
  UNRELIABLE  = 'UNRELIABLE',   // Majority failures
}

// ─── Failure Categories ──────────────────────────────────────────

export enum FailureType {
  TIMEOUT     = 'TIMEOUT',
  RATE_LIMIT  = 'RATE_LIMIT',   // 429
  AUTH        = 'AUTH',          // 401, 403
  NOT_FOUND   = 'NOT_FOUND',    // 404 (wrong model/endpoint)
  SERVER      = 'SERVER',       // 500+
  PARSE       = 'PARSE',        // Response parsing failure
  MOVE        = 'MOVE',         // Invalid chess move (not a provider issue)
}

// ─── Provider Health Snapshot ────────────────────────────────────

export interface ProviderHealthSnapshot {
  status: ProviderStatus;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgLatencyMs: number;
  adaptedCooldownMs: number;
  failureCounts: Record<FailureType, number>;
  consecutiveFailures: number;
  consecutive429s: number;
}

// ─── Provider Health Tracker ─────────────────────────────────────

export class ProviderTracker {
  private latencies: number[] = [];
  private totalCalls = 0;
  private successfulCalls = 0;
  private failureCounts: Map<FailureType, number> = new Map();
  private consecutiveFailures = 0;
  private consecutive429s = 0;
  private baseCooldownMs: number;
  private adaptedCooldownMs: number;
  private logger: Logger;
  private providerName: string;

  constructor(providerName: string, baseCooldownMs: number, logger: Logger) {
    this.providerName = providerName;
    this.baseCooldownMs = baseCooldownMs;
    this.adaptedCooldownMs = baseCooldownMs;
    this.logger = logger;

    // Initialize all failure counters
    for (const type of Object.values(FailureType)) {
      this.failureCounts.set(type, 0);
    }
  }

  /** Record a successful API call */
  recordSuccess(latencyMs: number): void {
    this.totalCalls++;
    this.successfulCalls++;
    this.latencies.push(latencyMs);
    this.consecutiveFailures = 0;
    this.consecutive429s = 0;

    // Gradually decrease cooldown after successes (floor = base cooldown)
    if (this.adaptedCooldownMs > this.baseCooldownMs) {
      this.adaptedCooldownMs = Math.max(
        this.baseCooldownMs,
        Math.floor(this.adaptedCooldownMs * 0.8),
      );
      this.logger.debug(`Provider ${this.providerName}: cooldown decreased to ${this.adaptedCooldownMs}ms`);
    }
  }

  /** Record a failed API call with categorized failure type */
  recordFailure(failureType: FailureType): void {
    this.totalCalls++;
    this.consecutiveFailures++;
    this.failureCounts.set(failureType, (this.failureCounts.get(failureType) || 0) + 1);

    if (failureType === FailureType.RATE_LIMIT) {
      this.consecutive429s++;
      // Aggressive cooldown escalation for 429s
      // Each consecutive 429 doubles the cooldown (cap at 60s)
      this.adaptedCooldownMs = Math.min(
        60000,
        this.baseCooldownMs * Math.pow(2, this.consecutive429s),
      );
      this.logger.warn(`Provider ${this.providerName}: 429 detected (×${this.consecutive429s}), cooldown → ${this.adaptedCooldownMs}ms`);
    } else if (failureType === FailureType.TIMEOUT) {
      // Moderate cooldown increase for timeouts
      this.adaptedCooldownMs = Math.min(
        30000,
        this.adaptedCooldownMs + 2000,
      );
    }
    // Auth and NotFound don't affect cooldown — they're config errors, not pacing issues
  }

  /** Get the current adapted cooldown (may be higher than base due to 429s/timeouts) */
  getAdaptedCooldownMs(): number {
    return this.adaptedCooldownMs;
  }

  /** Classify the provider's current health status */
  getStatus(): ProviderStatus {
    if (this.totalCalls === 0) return ProviderStatus.HEALTHY;

    const rate429 = (this.failureCounts.get(FailureType.RATE_LIMIT) || 0) / this.totalCalls;
    const successRate = this.successfulCalls / this.totalCalls;

    // Currently receiving 429s
    if (this.consecutive429s >= 2) return ProviderStatus.OVERLOADED;

    // More than 30% of calls are 429s
    if (rate429 > 0.3) return ProviderStatus.OVERLOADED;

    // Below 50% success rate
    if (successRate < 0.5 && this.totalCalls >= 3) return ProviderStatus.UNRELIABLE;

    // Below 75% success rate
    if (successRate < 0.75 && this.totalCalls >= 3) return ProviderStatus.UNSTABLE;

    // High average latency (>30s)
    const avgLatency = this.getAvgLatency();
    if (avgLatency > 30000 && this.latencies.length >= 2) return ProviderStatus.SLOW;

    return ProviderStatus.HEALTHY;
  }

  /** Get a complete health snapshot for reporting */
  getSnapshot(): ProviderHealthSnapshot {
    const counts: Record<FailureType, number> = {} as any;
    for (const [type, count] of this.failureCounts) {
      counts[type] = count;
    }

    return {
      status: this.getStatus(),
      totalCalls: this.totalCalls,
      successfulCalls: this.successfulCalls,
      failedCalls: this.totalCalls - this.successfulCalls,
      avgLatencyMs: this.getAvgLatency(),
      adaptedCooldownMs: this.adaptedCooldownMs,
      failureCounts: counts,
      consecutiveFailures: this.consecutiveFailures,
      consecutive429s: this.consecutive429s,
    };
  }

  /** Recommend whether a retry is worthwhile based on failure type */
  shouldRetry(failureType: FailureType): { retry: boolean; waitMs: number; reason: string } {
    switch (failureType) {
      case FailureType.AUTH:
        return { retry: false, waitMs: 0, reason: 'Authentication failed — check API key' };

      case FailureType.NOT_FOUND:
        return { retry: false, waitMs: 0, reason: 'Model or endpoint not found — check configuration' };

      case FailureType.RATE_LIMIT:
        // Exponential backoff for 429: 5s, 10s, 20s, 30s...
        const wait429 = Math.min(30000, 5000 * Math.pow(2, this.consecutive429s - 1));
        return { retry: true, waitMs: wait429, reason: `Rate limited — waiting ${wait429 / 1000}s` };

      case FailureType.TIMEOUT:
        return { retry: true, waitMs: 3000, reason: 'Request timed out — retrying with cooldown' };

      case FailureType.SERVER:
        return { retry: true, waitMs: 5000, reason: 'Server error — retrying after 5s' };

      case FailureType.PARSE:
        return { retry: true, waitMs: 1000, reason: 'Response parsing failed — retrying' };

      case FailureType.MOVE:
        return { retry: true, waitMs: 1000, reason: 'Invalid move — retrying' };

      default:
        return { retry: true, waitMs: 2000, reason: 'Unknown failure — retrying' };
    }
  }

  private getAvgLatency(): number {
    if (this.latencies.length === 0) return 0;
    return Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length);
  }
}

// ─── Multi-Agent Provider Manager ────────────────────────────────

/**
 * Manages ProviderTrackers for multiple agents.
 * Each agent gets its own tracker since they may use different providers.
 */
export class ProviderManager {
  private trackers: Map<number, ProviderTracker> = new Map();
  private logger: Logger;
  private baseCooldownMs: number;

  constructor(baseCooldownMs: number, logger: Logger) {
    this.baseCooldownMs = baseCooldownMs;
    this.logger = logger;
  }

  /** Initialize a tracker for an agent */
  initAgent(agentIndex: number, providerName: string): void {
    this.trackers.set(
      agentIndex,
      new ProviderTracker(providerName, this.baseCooldownMs, this.logger),
    );
  }

  /** Get the tracker for an agent */
  getTracker(agentIndex: number): ProviderTracker {
    const tracker = this.trackers.get(agentIndex);
    if (!tracker) throw new Error(`No tracker for agent ${agentIndex}`);
    return tracker;
  }

  /** Get health snapshots for all agents (for the match report) */
  getAllSnapshots(): Map<number, ProviderHealthSnapshot> {
    const snapshots = new Map<number, ProviderHealthSnapshot>();
    for (const [idx, tracker] of this.trackers) {
      snapshots.set(idx, tracker.getSnapshot());
    }
    return snapshots;
  }

  /** Classify an HTTP error code into a FailureType */
  static classifyError(error: any): FailureType {
    const code = error?.code;
    if (code === 401 || code === 403) return FailureType.AUTH;
    if (code === 404) return FailureType.NOT_FOUND;
    if (code === 429) return FailureType.RATE_LIMIT;
    if (code === 408) return FailureType.TIMEOUT;
    if (code >= 500) return FailureType.SERVER;
    if (error?.message?.includes('timed out')) return FailureType.TIMEOUT;
    return FailureType.SERVER; // default
  }
}
