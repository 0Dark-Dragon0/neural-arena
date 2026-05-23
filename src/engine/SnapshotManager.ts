// ================================================================
// Neural Arena — Snapshot Manager
// ================================================================
// Coordinates periodic state snapshots. Useful for reconstructing
// state quickly during replay without having to replay thousands
// of events from tick 0.
// ================================================================

import { WorldStateTree, StateNode } from './WorldStateTree';
import { EventStore } from './EventStore';
import { formatDeterministicId } from './DeterministicIds';

export interface Snapshot<T> {
  snapshotId: string;
  tick: number;
  eventId: string;
  nodeId: string;
  state: Readonly<T>;
  timestamp: number;
}

export class SnapshotManager<T> {
  private snapshots: Snapshot<T>[] = [];
  private stateTree: WorldStateTree<T>;
  private eventStore: EventStore;
  private nextSnapshotSequence: number = 1;

  constructor(stateTree: WorldStateTree<T>, eventStore: EventStore) {
    this.stateTree = stateTree;
    this.eventStore = eventStore;
  }

  /**
   * Take a manual snapshot of the current world state.
   */
  takeSnapshot(): Snapshot<T> | null {
    const currentNode = this.stateTree.getCurrentNode();
    if (!currentNode) return null;
    const snapshotSequence = this.nextSnapshotSequence++;

    const snapshot: Snapshot<T> = {
      snapshotId: formatDeterministicId('snapshot', snapshotSequence),
      tick: currentNode.tick,
      eventId: currentNode.eventId,
      nodeId: currentNode.id,
      state: currentNode.state,
      timestamp: currentNode.tick,
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Get all taken snapshots.
   */
  getSnapshots(): Snapshot<T>[] {
    return this.snapshots;
  }

  /**
   * Get the closest snapshot at or before the given tick.
   */
  getNearestSnapshotBefore(tick: number): Snapshot<T> | null {
    if (this.snapshots.length === 0) return null;
    
    // Reverse search (assuming snapshots are chronologically ordered)
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i].tick <= tick) {
        return this.snapshots[i];
      }
    }
    
    return null;
  }

  /**
   * Reconstruct the StateTree from a snapshot.
   */
  restoreSnapshot(snapshot: Snapshot<T>): void {
    // 1. Rollback event store (in a real system, you'd reset the event store pointer too, 
    // but here we just rebuild the state tree base).
    
    // 2. Clear state tree and force push the snapshot state as INIT.
    // In an actual rollback, you would find the snapshot's nodeId and call stateTree.rollback(),
    // but if we are booting from a file, we recreate the root.
    this.stateTree = new WorldStateTree<T>();
    this.stateTree.pushState(
      snapshot.state,
      snapshot.tick,
      snapshot.eventId,
      { transitionType: 'INIT', reason: 'RESTORE_FROM_SNAPSHOT' }
    );
  }
}
