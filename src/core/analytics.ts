// ================================================================
// Neural Arena — Analytics Tracker
// ================================================================
// Lightweight performance analytics for match evaluation.
// Tracks latency, retries, timeouts, and success rates per agent.
// ================================================================

import { TurnAnalytics, AgentAnalytics, MatchAnalytics } from './types';

export class AnalyticsTracker {
  private turnData: TurnAnalytics[] = [];
  private agentNames: string[] = [];

  setAgentNames(names: string[]): void {
    this.agentNames = names;
  }

  /** Record a completed turn (success or failure) */
  recordTurn(data: TurnAnalytics): void {
    this.turnData.push(data);
  }

  /** Build the final match analytics summary */
  buildReport(totalDurationMs: number): MatchAnalytics {
    const agentIndices = [...new Set(this.turnData.map(t => t.agentIndex))];

    const agents: AgentAnalytics[] = agentIndices.map(idx => {
      const turns = this.turnData.filter(t => t.agentIndex === idx);
      const successes = turns.filter(t => t.success);
      const latencies = successes.map(t => t.latencyMs);

      return {
        agentName: this.agentNames[idx] || `Agent ${idx}`,
        totalMoves: successes.length,
        avgLatencyMs: latencies.length > 0
          ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
          : 0,
        maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
        minLatencyMs: latencies.length > 0 ? Math.min(...latencies) : 0,
        totalRetries: turns.reduce((sum, t) => sum + t.retriesUsed, 0),
        totalTimeouts: turns.filter(t => t.timedOut).length,
        successRate: turns.length > 0
          ? Math.round((successes.length / turns.length) * 100)
          : 0,
      };
    });

    return {
      totalTurns: this.turnData.filter(t => t.success).length,
      totalDurationMs,
      agents,
      turnData: [...this.turnData],
    };
  }
}
