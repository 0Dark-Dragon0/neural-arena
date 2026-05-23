// ================================================================
// Neural Arena - Deterministic State Machine
// ================================================================

export interface StateTransition<TContext> {
  readonly from: string;
  readonly to: string;
  readonly event: string;
  readonly priority: number;
  readonly guard?: (context: Readonly<TContext>) => boolean;
}

export interface StateMachineSnapshot<TContext> {
  readonly state: string;
  readonly context: Readonly<TContext>;
}

export class StateMachine<TContext> {
  private currentState: string;
  private context: TContext;
  private readonly transitions: StateTransition<TContext>[];

  constructor(initialState: string, initialContext: TContext, transitions: readonly StateTransition<TContext>[]) {
    this.currentState = initialState;
    this.context = initialContext;
    this.transitions = [...transitions].sort((a, b) => {
      if (a.from !== b.from) return a.from.localeCompare(b.from);
      if (a.event !== b.event) return a.event.localeCompare(b.event);
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.to.localeCompare(b.to);
    });
  }

  send(event: string, contextPatch: Partial<TContext> = {}): StateMachineSnapshot<TContext> {
    this.context = Object.freeze({ ...(this.context as any), ...contextPatch }) as TContext;
    const transition = this.transitions.find(candidate =>
      candidate.from === this.currentState &&
      candidate.event === event &&
      (!candidate.guard || candidate.guard(this.context))
    );

    if (transition) {
      this.currentState = transition.to;
    }

    return this.snapshot();
  }

  snapshot(): StateMachineSnapshot<TContext> {
    return Object.freeze({
      state: this.currentState,
      context: Object.freeze({ ...(this.context as any) }) as Readonly<TContext>,
    });
  }
}
