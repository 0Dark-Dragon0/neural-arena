/**
 * TelemetryCollector — Local telemetry aggregation from simulation events.
 * 
 * Runs entirely on-device. Produces TelemetryPackets from event streams.
 * NEVER collects: API keys, secrets, prompts, local files, personal info.
 * ONLY collects: anonymized simulation-relevant metrics.
 */
import { RuntimeEvent } from '../types';

export interface TelemetryPacket {
  version: 1;
  sessionId: string;
  collectedAt: string;
  platform: 'electron' | 'web';

  simulation: {
    durationMs: number;
    totalTicks: number;
    totalMoves: number;
    totalEvents: number;
    result: string;
  };
  cognition: {
    avgThinkingTimeMs: number;
    escalationCount: number;
    correctionCount: number;
    rejectionCount: number;
    hallucinationRate: number;
    totalContextCompilations: number;
  };
  orchestration: {
    avgTicksPerMove: number;
    fsmTransitions: number;
    intentThroughput: number;
    eventDensity: number;
  };
  provider: {
    modelFamily: string;
    avgLatencyMs: number;
    fallbackCount: number;
    errorRate: number;
    totalRequests: number;
  };
}

function generateSessionId(): string {
  return `session-${Math.random().toString(36).slice(2, 10)}`;
}

function extractModelFamily(model: string): string {
  // Anonymize: "google/gemma-3n-e4b-it" → "gemma"
  const parts = model.split('/');
  const name = parts[parts.length - 1] || model;
  const family = name.split('-')[0];
  return family.toLowerCase();
}

/**
 * Collect telemetry from a completed simulation's event stream.
 * Pure function — no side effects, no external state.
 */
export function collectTelemetry(events: RuntimeEvent[]): TelemetryPacket {
  let totalMoves = 0;
  let rejections = 0;
  let escalations = 0;
  let corrections = 0;
  let fsmTransitions = 0;
  let contextCompilations = 0;
  let fallbacks = 0;
  let providerErrors = 0;
  let providerRequests = 0;
  let totalLatency = 0;
  let thinkingEvents = 0;
  let totalThinkingMs = 0;
  let lastThinkStart = 0;
  let modelFamily = 'unknown';

  const firstTick = events.length > 0 ? events[0].tick : 0;
  const lastTick = events.length > 0 ? events[events.length - 1].tick : 0;
  const firstTime = events.length > 0 ? events[0].simulationTimeMs : 0;
  const lastTime = events.length > 0 ? events[events.length - 1].simulationTimeMs : 0;

  let result = 'unknown';

  for (const event of events) {
    switch (event.type) {
      case 'INTENT_ACCEPTED':
        totalMoves++;
        break;
      case 'INTENT_REJECTED':
        rejections++;
        break;
      case 'AGENT_THINKING':
        thinkingEvents++;
        lastThinkStart = event.simulationTimeMs;
        break;
      case 'FSM_TRANSITION':
        fsmTransitions++;
        break;
      case 'CONTEXT_COMPILED':
      case 'COGNITIVE_PIPELINE_STARTED':
        contextCompilations++;
        break;
      case 'PROVIDER_REQUEST':
        providerRequests++;
        if (event.data?.model) modelFamily = extractModelFamily(event.data.model as string);
        break;
      case 'PROVIDER_RESPONSE':
        if (event.data?.latencyMs) totalLatency += event.data.latencyMs as number;
        break;
      case 'PROVIDER_ERROR':
        providerErrors++;
        break;
      case 'PROVIDER_FALLBACK_ACTIVATED':
        fallbacks++;
        break;
      case 'SIMULATION_STOPPED':
        if (event.data?.reason) result = event.data.reason as string;
        break;
    }

    // Detect escalation/correction from event types
    if (event.type.includes('ESCALAT')) escalations++;
    if (event.type.includes('CORRECT')) corrections++;
  }

  const durationMs = lastTime - firstTime;
  const totalTicks = lastTick - firstTick;
  const hallucinationRate = totalMoves > 0 ? rejections / (totalMoves + rejections) : 0;

  return {
    version: 1,
    sessionId: generateSessionId(),
    collectedAt: new Date().toISOString(),
    platform: typeof window !== 'undefined' && (window as any).process?.type ? 'electron' : 'web',

    simulation: {
      durationMs,
      totalTicks,
      totalMoves,
      totalEvents: events.length,
      result,
    },
    cognition: {
      avgThinkingTimeMs: thinkingEvents > 0 ? Math.round(durationMs / thinkingEvents) : 0,
      escalationCount: escalations,
      correctionCount: corrections,
      rejectionCount: rejections,
      hallucinationRate: Math.round(hallucinationRate * 1000) / 1000,
      totalContextCompilations: contextCompilations,
    },
    orchestration: {
      avgTicksPerMove: totalMoves > 0 ? Math.round(totalTicks / totalMoves) : 0,
      fsmTransitions,
      intentThroughput: durationMs > 0 ? Math.round((totalMoves / (durationMs / 60000)) * 10) / 10 : 0,
      eventDensity: totalTicks > 0 ? Math.round((events.length / totalTicks) * 100) / 100 : 0,
    },
    provider: {
      modelFamily,
      avgLatencyMs: providerRequests > 0 ? Math.round(totalLatency / providerRequests / 10) * 10 : 0, // Round to 10ms
      fallbackCount: fallbacks,
      errorRate: providerRequests > 0 ? Math.round((providerErrors / providerRequests) * 1000) / 1000 : 0,
      totalRequests: providerRequests,
    },
  };
}

/**
 * Anonymize a telemetry packet — strips any remaining identifiable info.
 * Returns a new packet safe for external sharing.
 */
export function anonymizePacket(packet: TelemetryPacket): TelemetryPacket {
  return {
    ...packet,
    sessionId: generateSessionId(), // Re-randomize session ID
    provider: {
      ...packet.provider,
      // Already anonymized to family level, but ensure no leakage
      modelFamily: packet.provider.modelFamily.split('/').pop()?.split('-')[0] || 'unknown',
    },
  };
}
