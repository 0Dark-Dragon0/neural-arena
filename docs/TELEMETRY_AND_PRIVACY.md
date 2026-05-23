# Telemetry and Privacy Architecture Specification

Neural Arena is designed as a **local-first, privacy-first software platform**. When evaluating autonomous agents, prompts frequently contain proprietary business logic, sensitive datasets, or internal developer communications. Streaming these interactions to third-party servers violates standard security compliance.

Neural Arena executes all telemetry aggregation on-device. This document details the technical implementation, schemas, anonymization steps, and security guarantees of the telemetry system.

---

## 1. The Core Privacy Contract

Neural Arena guarantees that:
1. **Prompts are never sent to external servers**: No system instructions, user messages, agent tactical memory, or model completions ever leave your device.
2. **API Keys are kept secure**: Provider profiles are saved locally using Web Storage (`localStorage` under Electron/Browser). Secrets are never transmitted in telemetry reports.
3. **Data collections are opt-in and auditable**: Telemetry sharing is off by default (`local-only`). If enabled, users can audit raw and anonymized JSON diffs directly in the UI before transmission.

---

## 2. Telemetry Aggregation Architecture

The telemetry loop runs at the end of each simulation, parsing the local event log to construct a `TelemetryPacket`.

```
┌────────────────────────────────────────────────────────┐
│                   Simulation Engine                    │
│   (Emits raw events: AGENT_THINKING, PROVIDER_REQ...)   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                   TelemetryCollector                   │
│         (Aggregates events into metrics packet)        │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                   TelemetryAnonymizer                  │
│       (Strips specific model IDs, hashes sessions)     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌───────────────────────────┴────────────────────────────┐
│                    Telemetry Review                    │
│        (Visual diff of RAW vs. ANONYMIZED packet)      │
└───────────────────────────┬────────────────────────────┘
                            │ (If Opted-In)
                            ▼
┌────────────────────────────────────────────────────────┐
│                     Telemetry Queue                    │
│              (Local storage queue cache)               │
└────────────────────────────────────────────────────────┘
```

---

## 3. Data Schema Specifications

The aggregated metric report is defined by the following schema:

```typescript
export interface TelemetryPacket {
  version: 1;
  sessionId: string;        // Random UUID generated per session, not linked to hardware
  collectedAt: string;      // ISO 8601 Timestamp
  platform: 'electron' | 'web';

  simulation: {
    durationMs: number;     // Total simulation runtime
    totalTicks: number;     // Engine clock cycles elapsed
    totalMoves: number;     // Executed valid intents
    totalEvents: number;    // Count of generated EventStore records
    result: string;         // Simulation termination reason (e.g., checkmate, timeout, resign)
  };

  cognition: {
    avgThinkingTimeMs: number;
    escalationCount: number;      // Re-prompt escalation depth triggers
    correctionCount: number;      // Model error correction iterations
    rejectionCount: number;       // Invalid intents submitted
    hallucinationRate: number;     // Ratio of rejections to total moves
    totalContextCompilations: number;
  };

  orchestration: {
    avgTicksPerMove: number;
    fsmTransitions: number;       // FSM lifecycle transitions
    intentThroughput: number;     // Accepted moves per minute
    eventDensity: number;         // Average events generated per tick
  };

  provider: {
    modelFamily: string;          // Coarse family name (e.g. "gemma", "llama", "gpt")
    avgLatencyMs: number;         // Rounded response time
    fallbackCount: number;        // Escalation to fallback model triggers
    errorRate: number;            // Provider API error rate
    totalRequests: number;        // Total API requests dispatched
  };
}
```

---

## 4. Anonymization Implementation

The [TelemetryCollector.ts](../src/dashboard/src/lib/telemetry/TelemetryCollector.ts) implements the aggregation and anonymization routines. Below is the core logic:

```typescript
import { RuntimeEvent } from '../types';

export class TelemetryCollector {
  /**
   * Aggregates raw events into a clean TelemetryPacket
   */
  public static collect(events: RuntimeEvent[], platform: 'electron' | 'web'): TelemetryPacket {
    let totalTicks = 0;
    let totalMoves = 0;
    let totalEvents = events.length;
    let result = 'unknown';
    
    let thinkingTimes: number[] = [];
    let escalationCount = 0;
    let correctionCount = 0;
    let rejectionCount = 0;
    let contextCompilations = 0;
    
    let fsmTransitions = 0;
    let totalRequests = 0;
    let errorRequests = 0;
    let fallbackCount = 0;
    let providerLatencies: number[] = [];
    let modelName = 'unknown';

    // Parse events log
    for (const event of events) {
      switch (event.type) {
        case 'TICK_ADVANCED':
          totalTicks++;
          break;
        case 'SIMULATION_STOPPED':
          result = event.data.reason || 'completed';
          break;
        case 'INTENT_ACCEPTED':
          totalMoves++;
          break;
        case 'INTENT_REJECTED':
          rejectionCount++;
          break;
        case 'COGNITIVE_CORRECTION_APPLIED':
          correctionCount++;
          break;
        case 'PROMPT_ESCALATION_LEVEL_CHANGED':
          escalationCount++;
          break;
        case 'CONTEXT_COMPILED':
          contextCompilations++;
          break;
        case 'FSM_TRANSITION':
          fsmTransitions++;
          break;
        case 'PROVIDER_REQUEST':
          totalRequests++;
          modelName = event.data.model || modelName;
          break;
        case 'PROVIDER_RESPONSE':
          providerLatencies.push(event.data.latencyMs || 0);
          break;
        case 'PROVIDER_ERROR':
          errorRequests++;
          break;
        case 'PROVIDER_FALLBACK_ACTIVATED':
          fallbackCount++;
          break;
      }
    }

    const avgThinkingTimeMs = thinkingTimes.length > 0 
      ? thinkingTimes.reduce((a, b) => a + b, 0) / thinkingTimes.length
      : 0;

    const avgLatencyMs = providerLatencies.length > 0
      ? providerLatencies.reduce((a, b) => a + b, 0) / providerLatencies.length
      : 0;

    const rawPacket: TelemetryPacket = {
      version: 1,
      sessionId: crypto.randomUUID(),
      collectedAt: new Date().toISOString(),
      platform,
      simulation: {
        durationMs: totalTicks * 100, // Derived estimation
        totalTicks,
        totalMoves,
        totalEvents,
        result
      },
      cognition: {
        avgThinkingTimeMs: Math.round(avgThinkingTimeMs),
        escalationCount,
        correctionCount,
        rejectionCount,
        hallucinationRate: totalMoves + rejectionCount > 0 
          ? rejectionCount / (totalMoves + rejectionCount) 
          : 0,
        totalContextCompilations: contextCompilations
      },
      orchestration: {
        avgTicksPerMove: totalMoves > 0 ? totalTicks / totalMoves : 0,
        fsmTransitions,
        intentThroughput: totalTicks > 0 ? (totalMoves / (totalTicks * 0.1)) * 60 : 0,
        eventDensity: totalTicks > 0 ? totalEvents / totalTicks : 0
      },
      provider: {
        modelFamily: this.anonymizeModel(modelName),
        avgLatencyMs: this.roundLatency(avgLatencyMs),
        fallbackCount,
        errorRate: totalRequests > 0 ? errorRequests / totalRequests : 0,
        totalRequests
      }
    };

    return rawPacket;
  }

  /**
   * Anonymizes specific model name into their broad family name
   */
  private static anonymizeModel(model: string): string {
    const parts = model.split('/');
    const name = parts[parts.length - 1] || model;
    const family = name.split('-')[0] || 'unknown';
    return family.toLowerCase();
  }

  /**
   * Rounds latency averages to the nearest 10ms to prevent execution-time fingerprinting
   */
  private static roundLatency(ms: number): number {
    return Math.round(ms / 10) * 10;
  }
}
```

---

## 5. User-Facing Privacy Controls

* **Review Panel**: Displays raw vs. anonymized JSON diffs, allowing users to verify what will be shared.
* **Erasure**: Wipes local storage queues and revokes active consents:
  ```typescript
  localStorage.removeItem('na_telemetry_queue');
  localStorage.removeItem('na_telemetry_consent');
  ```
* **Consent Categories**: Users can toggle permission for specific data categories:
  * `cognitionTiming`: Enables collection of think loop latency.
  * `orchestrationBehavior`: Tracks FSM transitions and scheduler patterns.
  * `modelPerformance`: Computes decision accuracy and hallucination rate indexes.
  * `providerReliability`: Records connection timeout and HTTP error frequencies.
  * `errorPatterns`: Collects counts of syntax rejection classes (e.g. invalid json vs illegal move).

---

## 6. Corporate Data Governance & Compliance

Because Neural Arena operates entirely on-device, it provides structural compliance with strict security frameworks:
* **GDPR compliance**: No Personal Data (PII) or IP addresses are harvested. Session tokens are randomized, preventing cross-session tracking.
* **HIPAA compatibility**: Prompts that may contain protected health information (PHI) are kept strictly within local volatile memory or user-encrypted local folders, never leaving the machine.
* **Enterprise Air-Gapping**: For maximum security environments, Neural Arena can run inside air-gapped systems. Telemetry collection is simply disabled, keeping all systems fully operational offline.
