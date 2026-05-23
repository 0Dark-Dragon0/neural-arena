/**
 * BenchmarkScorer — Computes domain-agnostic benchmark scores from event streams.
 * 
 * Pure function: events[] → BenchmarkResult
 * No side effects, no external state, fully deterministic.
 */
import { BenchmarkResult, AgentBenchmark, CognitionMetrics, OrchestrationMetrics } from './BenchmarkSchema';

interface ScoringEvent {
  eventId: string;
  type: string;
  tick: number;
  simulationTimeMs: number;
  sequence: number;
  data: Record<string, any>;
  causedByEventId?: string;
}

function generateBenchmarkId(): string {
  return `bench-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function scoreBenchmark(events: ScoringEvent[], domain: string = 'chess'): BenchmarkResult {
  // Per-agent tracking
  const agentIntents: Record<number, { accepted: number; rejected: number; latencies: number[] }> = {};
  const agentModels: Record<number, string> = {};

  // Global counters
  let fsmTransitions = 0;
  let contextCompilations = 0;
  let strategyChanges = 0;
  let escalations = 0;
  let corrections = 0;
  let providerRequests = 0;
  let providerErrors = 0;

  const firstTick = events.length > 0 ? events[0].tick : 0;
  const lastTick = events.length > 0 ? events[events.length - 1].tick : 0;
  const firstTime = events.length > 0 ? events[0].simulationTimeMs : 0;
  const lastTime = events.length > 0 ? events[events.length - 1].simulationTimeMs : 0;

  for (const event of events) {
    const agentIdx = event.data?.agentIndex as number | undefined;

    if (agentIdx !== undefined && !agentIntents[agentIdx]) {
      agentIntents[agentIdx] = { accepted: 0, rejected: 0, latencies: [] };
    }

    switch (event.type) {
      case 'INTENT_ACCEPTED':
        if (agentIdx !== undefined) agentIntents[agentIdx].accepted++;
        break;
      case 'INTENT_REJECTED':
        if (agentIdx !== undefined) agentIntents[agentIdx].rejected++;
        break;
      case 'FSM_TRANSITION':
        fsmTransitions++;
        break;
      case 'CONTEXT_COMPILED':
      case 'COGNITIVE_PIPELINE_STARTED':
        contextCompilations++;
        break;
      case 'STRATEGY_SELECTED':
        strategyChanges++;
        break;
      case 'PROVIDER_REQUEST':
        providerRequests++;
        if (event.data?.model && agentIdx !== undefined) {
          agentModels[agentIdx] = event.data.model as string;
        }
        break;
      case 'PROVIDER_RESPONSE':
        if (event.data?.latencyMs && agentIdx !== undefined && agentIntents[agentIdx]) {
          agentIntents[agentIdx].latencies.push(event.data.latencyMs as number);
        }
        break;
      case 'PROVIDER_ERROR':
        providerErrors++;
        break;
    }

    if (event.type.includes('ESCALAT')) escalations++;
    if (event.type.includes('CORRECT')) corrections++;
  }

  const durationMs = lastTime - firstTime;
  const totalTicks = lastTick - firstTick;
  const totalMoves = Object.values(agentIntents).reduce((sum, a) => sum + a.accepted, 0);
  const totalRejections = Object.values(agentIntents).reduce((sum, a) => sum + a.rejected, 0);

  // Build agent benchmarks
  const agents: AgentBenchmark[] = Object.entries(agentIntents).map(([idx, data]) => {
    const index = parseInt(idx);
    const total = data.accepted + data.rejected;
    const avgLatency = data.latencies.length > 0
      ? data.latencies.reduce((s, l) => s + l, 0) / data.latencies.length
      : 0;

    // Consistency: lower rejection variance = higher consistency
    const rejectionRate = total > 0 ? data.rejected / total : 0;

    // Adaptation: fewer escalations relative to rejections = better adaptation
    const agentEscalations = escalations / Math.max(Object.keys(agentIntents).length, 1);
    const adaptationScore = total > 0
      ? Math.max(0, 1 - (agentEscalations / Math.max(total, 1)))
      : 0.5;

    const modelRaw = agentModels[index] || 'unknown';
    const modelFamily = modelRaw.split('/').pop()?.split('-')[0] || 'unknown';

    return {
      agentIndex: index,
      modelFamily,
      providerType: modelRaw.includes('/') ? modelRaw.split('/')[0] : 'unknown',
      decisionQuality: total > 0 ? Math.round((data.accepted / total) * 1000) / 1000 : 0,
      adaptationScore: Math.round(adaptationScore * 1000) / 1000,
      consistencyScore: Math.round((1 - rejectionRate) * 1000) / 1000,
      hallucinationRate: Math.round(rejectionRate * 1000) / 1000,
      avgResponseTimeMs: Math.round(avgLatency),
    };
  });

  const cognition: CognitionMetrics = {
    totalContextCompilations: contextCompilations,
    avgContextTokens: 0, // Would need token counting in events
    strategyChanges,
    correctionRate: totalMoves > 0 ? Math.round((corrections / totalMoves) * 1000) / 1000 : 0,
    escalationDepth: escalations,
  };

  const orchestration: OrchestrationMetrics = {
    totalTicks,
    avgTicksPerAction: totalMoves > 0 ? Math.round(totalTicks / totalMoves) : 0,
    fsmTransitions,
    intentThroughput: durationMs > 0 ? Math.round((totalMoves / (durationMs / 60000)) * 10) / 10 : 0,
    eventDensity: totalTicks > 0 ? Math.round((events.length / totalTicks) * 100) / 100 : 0,
  };

  return {
    version: 1,
    id: generateBenchmarkId(),
    domain,
    timestamp: new Date().toISOString(),
    durationMs,
    agents,
    cognition,
    orchestration,
  };
}
