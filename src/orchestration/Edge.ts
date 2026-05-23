// ================================================================
// Neural Arena - Orchestration Edge
// ================================================================

export type EdgePredicate<TState> = (state: Readonly<TState>, transitionKey?: string) => boolean;

export interface OrchestrationEdge<TState> {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly priority: number;
  readonly transitionKey?: string;
  readonly condition?: EdgePredicate<TState>;
}

export function createEdge<TState>(
  id: string,
  from: string,
  to: string,
  priority: number = 0,
  transitionKey?: string,
  condition?: EdgePredicate<TState>,
): OrchestrationEdge<TState> {
  return Object.freeze({
    id,
    from,
    to,
    priority,
    transitionKey,
    condition,
  });
}
