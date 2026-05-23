/**
 * BenchmarkSchema — Domain-agnostic autonomous cognition benchmark types.
 * 
 * These schemas score agent performance independently of simulation domain.
 * Chess-specific scoring lives in adapters, not here.
 */

export interface AgentBenchmark {
  agentIndex: number;
  modelFamily: string;
  providerType: string;

  /** % of intents accepted (0.0 – 1.0) */
  decisionQuality: number;
  /** Escalation efficiency — lower is better (0.0 – 1.0) */
  adaptationScore: number;
  /** Action pattern stability (0.0 – 1.0) */
  consistencyScore: number;
  /** % of invalid/rejected outputs (0.0 – 1.0) */
  hallucinationRate: number;
  /** Average response time in ms */
  avgResponseTimeMs: number;
}

export interface CognitionMetrics {
  totalContextCompilations: number;
  avgContextTokens: number;
  strategyChanges: number;
  correctionRate: number;
  escalationDepth: number;
}

export interface OrchestrationMetrics {
  totalTicks: number;
  avgTicksPerAction: number;
  fsmTransitions: number;
  /** Accepted intents per minute */
  intentThroughput: number;
  /** Events per tick */
  eventDensity: number;
}

export interface BenchmarkResult {
  version: 1;
  id: string;
  /** Simulation domain — 'chess', 'negotiation', 'debate', etc. */
  domain: string;
  timestamp: string;
  durationMs: number;

  agents: AgentBenchmark[];
  cognition: CognitionMetrics;
  orchestration: OrchestrationMetrics;

  /** Domain-specific extension data */
  domainData?: Record<string, unknown>;
}
