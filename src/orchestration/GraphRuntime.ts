// ================================================================
// Neural Arena - Deterministic Graph Runtime
// ================================================================
// Executes node graphs in stable order. Edges are selected by
// priority, id, and optional transition predicates.
// ================================================================

import { OrchestrationEdge } from './Edge';
import { OrchestrationNode } from './Node';

export interface GraphRuntimeEvent<TState> {
  readonly type: 'FSM_NODE_EXECUTED' | 'COGNITIVE_GRAPH_TRANSITION';
  readonly nodeId?: string;
  readonly edgeId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly transitionKey?: string;
  readonly state: Readonly<TState>;
  readonly output?: Readonly<Record<string, unknown>>;
}

export type GraphRuntimeObserver<TState> = (event: GraphRuntimeEvent<TState>) => void;

export interface GraphRunResult<TState> {
  readonly finalNodeId: string;
  readonly state: TState;
  readonly steps: readonly string[];
}

export class GraphRuntime<TState> {
  private readonly nodes: Map<string, OrchestrationNode<TState>>;
  private readonly edges: OrchestrationEdge<TState>[];
  private readonly observer?: GraphRuntimeObserver<TState>;

  constructor(
    nodes: readonly OrchestrationNode<TState>[],
    edges: readonly OrchestrationEdge<TState>[],
    observer?: GraphRuntimeObserver<TState>,
  ) {
    this.nodes = new Map(nodes.map(node => [node.id, node]));
    this.edges = [...edges].sort((a, b) => {
      if (a.from !== b.from) return a.from.localeCompare(b.from);
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.id.localeCompare(b.id);
    });
    this.observer = observer;
  }

  run(startNodeId: string, initialState: TState, maxSteps: number = 32): GraphRunResult<TState> {
    let currentNodeId = startNodeId;
    let state = initialState;
    const steps: string[] = [];

    for (let step = 0; step < maxSteps; step++) {
      const node = this.nodes.get(currentNodeId);
      if (!node) {
        throw new Error(`Graph node not found: ${currentNodeId}`);
      }

      const result = node.execute(Object.freeze({ ...(state as any) }) as Readonly<TState>);
      state = result.state;
      steps.push(currentNodeId);

      this.observer?.({
        type: 'FSM_NODE_EXECUTED',
        nodeId: node.id,
        transitionKey: result.transitionKey,
        state,
        output: result.output,
      });

      if (node.kind === 'TERMINAL') {
        return Object.freeze({ finalNodeId: currentNodeId, state, steps: Object.freeze(steps) });
      }

      const edge = this.selectEdge(currentNodeId, state, result.transitionKey);
      if (!edge) {
        return Object.freeze({ finalNodeId: currentNodeId, state, steps: Object.freeze(steps) });
      }

      this.observer?.({
        type: 'COGNITIVE_GRAPH_TRANSITION',
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
        transitionKey: result.transitionKey,
        state,
      });

      currentNodeId = edge.to;
    }

    return Object.freeze({ finalNodeId: currentNodeId, state, steps: Object.freeze(steps) });
  }

  private selectEdge(nodeId: string, state: TState, transitionKey?: string): OrchestrationEdge<TState> | null {
    const candidates = this.edges.filter(edge => edge.from === nodeId);

    for (const edge of candidates) {
      if (edge.transitionKey !== undefined && edge.transitionKey !== transitionKey) {
        continue;
      }

      if (edge.condition && !edge.condition(Object.freeze({ ...(state as any) }) as Readonly<TState>, transitionKey)) {
        continue;
      }

      return edge;
    }

    return null;
  }
}
