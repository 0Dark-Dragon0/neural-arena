// ================================================================
// Neural Arena — Intent Validator
// ================================================================
// Validates intents before they are allowed into the Simulation Gateway.
// Acts as an anti-corruption layer.
// ================================================================

export enum IntentType {
  SUBMIT_ACTION = 'SUBMIT_ACTION',
  FORFEIT = 'FORFEIT',
  API_ERROR = 'API_ERROR',
  QUERY_STATE = 'QUERY_STATE',
}

export enum IntentStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  STALE = 'STALE',
  EXPIRED = 'EXPIRED',
  SUPERSEDED = 'SUPERSEDED',
}

export interface IntentCausalityContext {
  requestId: string;
  sourceEventId: string;
  agentIndex: number;
  turnNumber: number;
  originTick: number;
  stateNodeId: string;
  stateHash: string;
}

export interface RawIntent {
  agentId: string;
  type: string;
  payload: any;
  causality?: Partial<IntentCausalityContext>;
}

export interface ValidatedIntent {
  sequence: number;
  intentId: string;
  agentId: string;
  agentIndex: number;
  type: IntentType;
  payload: Readonly<Record<string, any>>;
  requestId: string;
  sourceEventId: string;
  turnNumber: number;
  originTick: number;
  stateNodeId: string;
  stateHash: string;
  submittedAtTick: number;
  priority: number;
  status: IntentStatus;
  statusUpdatedAtTick: number;
  statusEventId: string | null;
  statusReason?: string;
}

export class IntentValidator {
  /**
   * Validates a raw intent object. Throws an error if invalid.
   * Otherwise, returns a clean ValidatedIntent object.
   */
  static validate(raw: RawIntent, currentTick: number, intentId: string, sequence: number): ValidatedIntent {
    if (!raw.agentId || typeof raw.agentId !== 'string') {
      throw new Error('Invalid agentId: must be a non-empty string');
    }

    if (!raw.type || !Object.values(IntentType).includes(raw.type as IntentType)) {
      throw new Error(`Invalid intent type: ${raw.type}`);
    }

    if (!raw.payload || typeof raw.payload !== 'object') {
      throw new Error('Invalid payload: must be an object');
    }

    // Default priority mapping based on type
    let priority = 10;
    if (raw.type === IntentType.FORFEIT) priority = 100; // Forfeits process immediately
    if (raw.type === IntentType.API_ERROR) priority = 90;

    const payload = Object.freeze({ ...raw.payload });
    const causality = raw.causality ?? raw.payload.causality ?? {};
    const payloadAgentIndex = typeof raw.payload.agentIndex === 'number' ? raw.payload.agentIndex : undefined;
    const agentIndex = typeof causality.agentIndex === 'number'
      ? causality.agentIndex
      : payloadAgentIndex ?? -1;

    return {
      sequence,
      intentId,
      agentId: raw.agentId,
      agentIndex,
      type: raw.type as IntentType,
      payload,
      requestId: typeof causality.requestId === 'string' ? causality.requestId : 'request-missing',
      sourceEventId: typeof causality.sourceEventId === 'string' ? causality.sourceEventId : 'event-missing',
      turnNumber: typeof causality.turnNumber === 'number' ? causality.turnNumber : -1,
      originTick: typeof causality.originTick === 'number' ? causality.originTick : currentTick,
      stateNodeId: typeof causality.stateNodeId === 'string' ? causality.stateNodeId : 'state-missing',
      stateHash: typeof causality.stateHash === 'string' ? causality.stateHash : 'hash-missing',
      submittedAtTick: currentTick,
      priority,
      status: IntentStatus.VALIDATED,
      statusUpdatedAtTick: currentTick,
      statusEventId: null,
    };
  }
}
