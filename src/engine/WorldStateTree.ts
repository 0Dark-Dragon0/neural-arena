// ================================================================
// Neural Arena — World State Tree
// ================================================================
// Maintains the immutable state history of the simulation.
// Every state transition creates a new linked node. Supports
// branching, rollback, and two diffing strategies (Hash & Deep).
// ================================================================

import * as crypto from 'crypto';
import { formatDeterministicId } from './DeterministicIds';

export interface TransitionMetadata {
  transitionType: 'INIT' | 'ACTION_APPLIED' | 'ROLLBACK' | 'BRANCH';
  agentIndex?: number;
  turnNumber?: number;
  action?: string;
  intentId?: string;
  requestId?: string;
  sourceEventId?: string;
  reason?: string;
}

export interface StateNode<T> {
  readonly id: string;           // Deterministic monotonic node ID
  readonly sequence: number;     // Monotonic numeric order
  readonly tick: number;         // Tick when this state was created
  readonly eventId: string;      // Event ID that caused this state
  readonly state: Readonly<T>;   // Deep-frozen state snapshot
  readonly parentId: string | null; // Link to parent for tree structure
  readonly metadata: Readonly<TransitionMetadata>;
  readonly stateHash: string;    // Fast SHA-256 hash for integrity checks
}

export interface DiffResult {
  isEqual: boolean;
  differences?: any; // Will hold deep structure changes if deep diffing is used
}

export class WorldStateTree<T> {
  private nodes: Map<string, StateNode<T>> = new Map();
  private currentNodeId: string | null = null;
  private rootNodeId: string | null = null;
  private nextSequence: number = 1;

  /**
   * Push a new state onto the tree as a child of the current state.
   */
  pushState(
    state: T,
    tick: number,
    eventId: string,
    metadata: TransitionMetadata
  ): string {
    const sequence = this.nextSequence++;
    const id = formatDeterministicId('state', sequence);
    const frozenState = this.deepFreeze(this.cloneState(state));
    
    const node: StateNode<T> = {
      id,
      sequence,
      tick,
      eventId,
      state: frozenState,
      parentId: this.currentNodeId,
      metadata: Object.freeze({ ...metadata }),
      stateHash: this.hashState(frozenState),
    };

    this.nodes.set(id, node);
    this.currentNodeId = id;
    
    if (!this.rootNodeId) {
      this.rootNodeId = id;
    }

    return id;
  }

  /**
   * Get the current authoritative state node.
   */
  getCurrentNode(): StateNode<T> | null {
    if (!this.currentNodeId) return null;
    return this.nodes.get(this.currentNodeId) || null;
  }

  /**
   * Get the current state payload directly.
   */
  getCurrentState(): Readonly<T> | null {
    const node = this.getCurrentNode();
    return node ? node.state : null;
  }

  /**
   * Get any historical node by ID.
   */
  getNode(id: string): StateNode<T> | null {
    return this.nodes.get(id) || null;
  }

  /**
   * Rollback the current authoritative state pointer to a historical node.
   * Note: This does not delete the nodes that came after it (preserving the tree),
   * but subsequent pushState() calls will branch from this historical node.
   */
  rollback(toNodeId: string): boolean {
    if (!this.nodes.has(toNodeId)) return false;
    this.currentNodeId = toNodeId;
    return true;
  }

  /**
   * Get the linear history from the current node back to the root.
   */
  getTimeline(): StateNode<T>[] {
    const timeline: StateNode<T>[] = [];
    let currentId = this.currentNodeId;

    while (currentId) {
      const node = this.nodes.get(currentId);
      if (!node) break;
      timeline.unshift(node);
      currentId = node.parentId;
    }

    return timeline;
  }

  // ── Diffing Engine ──────────────────────────────────────────────

  /**
   * Fast hash-based comparison.
   * Best for determinism checks and replay verification.
   */
  diffHash(nodeIdA: string, nodeIdB: string): DiffResult {
    const a = this.nodes.get(nodeIdA);
    const b = this.nodes.get(nodeIdB);
    if (!a || !b) throw new Error('Nodes not found for diffing');

    return {
      isEqual: a.stateHash === b.stateHash,
    };
  }

  /**
   * Deep structural comparison.
   * Best for debugging, observability tooling, and time-travel inspection.
   */
  diffDeep(nodeIdA: string, nodeIdB: string): DiffResult {
    const a = this.nodes.get(nodeIdA);
    const b = this.nodes.get(nodeIdB);
    if (!a || !b) throw new Error('Nodes not found for diffing');

    if (a.stateHash === b.stateHash) {
      return { isEqual: true, differences: null };
    }

    const differences = this.calculateDeepDiff(a.state, b.state);
    return {
      isEqual: false,
      differences,
    };
  }

  // ── Internal Helpers ─────────────────────────────────────────────

  private hashState(state: any): string {
    const str = typeof state === 'string' ? state : this.stableStringify(state);
    return crypto.createHash('sha256').update(str || '').digest('hex');
  }

  private cloneState(state: T): T {
    // For pure JSON states, JSON parse/stringify is safe and fast enough.
    // If we have class instances in state, this will strip them, which is
    // an intended guard rail for determinism (state should be plain data).
    return JSON.parse(JSON.stringify(state));
  }

  private deepFreeze<S>(obj: S): Readonly<S> {
    if (obj === null || typeof obj !== 'object') return obj as Readonly<S>;

    Object.keys(obj).forEach(prop => {
      const value = (obj as any)[prop];
      if (typeof value === 'object' && value !== null) {
        this.deepFreeze(value);
      }
    });

    return Object.freeze(obj);
  }

  private calculateDeepDiff(obj1: any, obj2: any): any {
    // A simplified structural diff adapter. 
    // In a production system, we might drop in `deep-diff` or `microdiff`.
    const diff: any = {};
    
    // Check keys in obj2
    for (const key in obj2) {
      if (!(key in obj1)) {
        diff[key] = { type: 'ADDED', value: obj2[key] };
      } else if (typeof obj2[key] === 'object' && obj2[key] !== null) {
        const nestedDiff = this.calculateDeepDiff(obj1[key], obj2[key]);
        if (Object.keys(nestedDiff).length > 0) {
          diff[key] = { type: 'MODIFIED_NESTED', diff: nestedDiff };
        }
      } else if (obj1[key] !== obj2[key]) {
        diff[key] = { type: 'MODIFIED', from: obj1[key], to: obj2[key] };
      }
    }
    
    // Check keys deleted from obj1
    for (const key in obj1) {
      if (!(key in obj2)) {
        diff[key] = { type: 'DELETED', oldValue: obj1[key] };
      }
    }
    
    return diff;
  }

  private stableStringify(value: any): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map(item => this.stableStringify(item)).join(',')}]`;
    }

    const keys = Object.keys(value).sort();
    const entries = keys.map(key => `${JSON.stringify(key)}:${this.stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
  }
}
