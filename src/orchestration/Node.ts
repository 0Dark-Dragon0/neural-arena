// ================================================================
// Neural Arena - Orchestration Node
// ================================================================

export type OrchestrationNodeKind = 'COGNITIVE' | 'VALIDATOR' | 'TRANSFORM' | 'TERMINAL';

export interface NodeExecutionResult<TState> {
  readonly state: TState;
  readonly output?: Readonly<Record<string, unknown>>;
  readonly transitionKey?: string;
}

export interface OrchestrationNode<TState> {
  readonly id: string;
  readonly kind: OrchestrationNodeKind;
  readonly label: string;
  execute(state: Readonly<TState>): NodeExecutionResult<TState>;
}

export type NodeExecutor<TState> = (state: Readonly<TState>) => NodeExecutionResult<TState>;

export class DeterministicNode<TState> implements OrchestrationNode<TState> {
  readonly id: string;
  readonly kind: OrchestrationNodeKind;
  readonly label: string;
  private readonly executor: NodeExecutor<TState>;

  constructor(id: string, kind: OrchestrationNodeKind, label: string, executor: NodeExecutor<TState>) {
    this.id = id;
    this.kind = kind;
    this.label = label;
    this.executor = executor;
  }

  execute(state: Readonly<TState>): NodeExecutionResult<TState> {
    return this.executor(state);
  }
}
