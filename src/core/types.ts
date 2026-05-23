// ================================================================
// Neural Arena — Core Type Definitions
// ================================================================
// All interfaces, types, and enums used across the engine.
// The BattlefieldPlugin interface is the architectural spine.
// ================================================================

// ─── Plugin System ───────────────────────────────────────────────

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  minAgents: number;
  maxAgents: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface GameResult {
  winner: number | null;   // agent index (0 or 1), or null for draw
  reason: string;          // "checkmate", "stalemate", "forfeit", etc.
  isDraw: boolean;
}

export interface PromptPair {
  systemPrompt: string;
  userPrompt: string;
}

export interface ResponseSchema {
  type: 'object';
  properties: Record<string, { type: string }>;
  required: string[];
}

export interface TurnRecord {
  turnNumber: number;
  agentIndex: number;
  action: string;
  timestamp: number;
  durationMs: number;
  retriesUsed: number;
}

/**
 * The Battlefield Plugin Interface.
 *
 * This is the architectural spine of Neural Arena.
 * Every battlefield (chess, coding, negotiation, etc.) implements this.
 * The Core Engine ONLY interacts with plugins through this contract.
 *
 * RULE: The Core Engine must NEVER contain game-specific logic.
 *       If you write `if (game === 'chess')` in the core, the architecture is broken.
 */
export interface BattlefieldPlugin {
  readonly metadata: PluginMetadata;

  // --- State Management ---
  initialize(): unknown;
  serializeState(state: unknown): string;
  deserializeState(data: string): unknown;

  // --- Rules Engine ---
  getLegalActions(state: unknown): string[];
  validateAction(state: unknown, action: string): ValidationResult;
  applyAction(state: unknown, action: string): unknown;
  getCurrentAgent(state: unknown): number;

  // --- Terminal Conditions ---
  isTerminal(state: unknown): boolean;
  getResult(state: unknown): GameResult;

  // --- AI Interface ---
  formatPrompt(state: unknown, legalActions: string[]): PromptPair;
  parseResponse(rawJson: Record<string, unknown>): string;
  getResponseSchema(): ResponseSchema;

  // --- Recording ---
  formatRecord(history: TurnRecord[], agentNames: string[]): string;
}

// ─── Agent System ────────────────────────────────────────────────

export interface AgentConfig {
  name: string;        // display name (model name)
  apiKey: string;
  baseUrl: string;
  model: string;
  index: number;       // 0 or 1
}

// ─── Simulation ──────────────────────────────────────────────────

export enum SimulationState {
  CONFIGURING = 'CONFIGURING',
  READY       = 'READY',
  RUNNING     = 'RUNNING',
  COMPLETE    = 'COMPLETE',
  ERROR       = 'ERROR',
  FORFEIT     = 'FORFEIT',
}

export interface SimulationConfig {
  maxRetries: number;         // retries per turn for invalid moves
  timeoutMs: number;          // API call timeout
  maxResponseBytes: number;   // anti-cheat: max response size
  maxTokens: number;          // max_tokens sent to API
  cooldownMs: number;         // delay between API calls (provider pacing)
  tickRateMs: number;         // deterministic simulation tick rate
}

export interface MatchResult {
  state: SimulationState;
  result: GameResult;
  turns: TurnRecord[];
  durationMs: number;
  pluginRecord: string;   // PGN for chess, other formats for other games
  agents: { name: string; model: string }[];
  timestamp: number;
  analytics: MatchAnalytics;
  providerHealth?: Record<number, any>;  // per-agent provider health snapshots
}

// ─── Events ──────────────────────────────────────────────────────

export enum EventType {
  MATCH_START     = 'MATCH_START',
  TURN_START      = 'TURN_START',
  COOLDOWN        = 'COOLDOWN',
  API_CALL_START  = 'API_CALL_START',
  API_CALL_END    = 'API_CALL_END',
  NORMALIZATION_PASS = 'NORMALIZATION_PASS',
  NORMALIZATION_FAIL = 'NORMALIZATION_FAIL',
  ANTICHEAT_PASS  = 'ANTICHEAT_PASS',
  ANTICHEAT_FAIL  = 'ANTICHEAT_FAIL',
  MOVE_VALID      = 'MOVE_VALID',
  MOVE_INVALID    = 'MOVE_INVALID',
  RETRY           = 'RETRY',
  AGENT_FORFEIT   = 'AGENT_FORFEIT',
  MATCH_COMPLETE  = 'MATCH_COMPLETE',
  MATCH_ERROR     = 'MATCH_ERROR',
}

export interface GameEvent {
  type: EventType;
  timestamp: number;
  data: Record<string, unknown>;
}

// ─── Anti-Cheat ──────────────────────────────────────────────────

export interface AntiCheatResult {
  passed: boolean;
  gateFailed?: string;
  reason?: string;
  parsedAction?: string;
  normalizationStrategy?: string;
}

// ─── API Client ──────────────────────────────────────────────────

export interface ApiResponse {
  content: string;
  durationMs: number;
  tokensUsed?: number;
}

// ─── Analytics ───────────────────────────────────────────────────

export interface TurnAnalytics {
  turnNumber: number;
  agentIndex: number;
  latencyMs: number;
  retriesUsed: number;
  timedOut: boolean;
  success: boolean;
}

export interface AgentAnalytics {
  agentName: string;
  totalMoves: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  totalRetries: number;
  totalTimeouts: number;
  successRate: number;
}

export interface MatchAnalytics {
  totalTurns: number;
  totalDurationMs: number;
  agents: AgentAnalytics[];
  turnData: TurnAnalytics[];
}

// ─── Logger ──────────────────────────────────────────────────────

export enum LogLevel {
  DEBUG = 0,
  INFO  = 1,
  WARN  = 2,
  ERROR = 3,
}
