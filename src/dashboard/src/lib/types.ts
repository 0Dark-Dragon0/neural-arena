export type RuntimeEventType =
  | 'SIMULATION_STARTED'
  | 'SIMULATION_STOPPED'
  | 'TICK'
  | 'WORLD_STATE_UPDATED'
  | 'WORLD_WAITING_FOR_INTENT'
  | 'INTENT_ACCEPTED'
  | 'INTENT_REJECTED'
  | 'INTENT_STALE_REJECTED'
  | 'PROVIDER_FALLBACK_ACTIVATED'
  | 'PROVIDER_COMPATIBILITY_DECISION'
  | 'NORMALIZATION_RECOVERY'
  | 'ANTICHEAT_PASS'
  | 'ANTICHEAT_FAIL'
  | 'PROMPT_STRATEGY_SELECTED'
  | 'COGNITIVE_CORRECTION_APPLIED'
  | 'PROMPT_ESCALATION_LEVEL_CHANGED'
  | 'ILLEGAL_MOVE_PATTERN_DETECTED'
  | 'CONTEXT_COMPILED'
  | 'MEMORY_BLOCK_INJECTED'
  | 'PERSONA_BLOCK_INJECTED'
  | 'CONSTRAINT_BLOCK_INJECTED'
  | 'COGNITIVE_GRAPH_TRANSITION'
  | 'FSM_NODE_EXECUTED'
  | string;

export interface RuntimeEvent {
  eventId: string;
  sequence: number;
  type: RuntimeEventType;
  tick: number;
  simulationTimeMs: number;
  wallTimestampMs: number;
  causedByEventId: string | null;
  data: Record<string, unknown>;
  version: number;
}

export type AgentLifecycle =
  | 'IDLE'
  | 'THINKING'
  | 'VALIDATING'
  | 'CORRECTING'
  | 'SUBMITTING'
  | 'REJECTED'
  | 'ACCEPTED'
  | 'ERROR'
  | 'FORFEITED';

export interface AgentTelemetry {
  id: number;
  name: string;
  model: string;
  provider: string;
  capabilityTier: string;
  cognitionMode: string;
  escalationLevel: number;
  memoryPressure: number;
  hallucinationRisk: string;
  retries: number;
  lifecycle: AgentLifecycle;
  lastIntent?: string;
  lastAction?: string;
  lastEventId?: string;
}

export interface WorldTelemetry {
  tick: number;
  simulationTimeMs: number;
  speed: string;
  activeAgentIndex: number | null;
  turnNumber: number;
  currentStateLabel: string;
  stateHash?: string;
  legalActions: string[];
  fen?: string;
}

export interface WorldStateNode {
  id: string;
  parentId: string | null;
  tick: number;
  eventId: string;
  label: string;
  stateHash?: string;
  transitionType?: string;
  action?: string;
}

export interface ProviderSample {
  tick: number;
  latencyMs: number;
  tokens: number;
  health: number;
  throughput: number;
  cooldownMs: number;
}

export interface CognitionNode {
  id: string;
  label: string;
  kind: 'observe' | 'analyze' | 'validate' | 'execute' | 'correct';
  active: boolean;
  lastTick?: number;
}

export interface TraceDocument {
  name: string;
  content: string;
  sections: TraceSection[];
}

export interface TraceSection {
  title: string;
  body: string;
}

export type ConnectionStatus = 'offline' | 'connecting' | 'live' | 'demo';
