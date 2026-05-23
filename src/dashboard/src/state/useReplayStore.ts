/**
 * useReplayEngine — Deterministic replay engine for Neural Arena.
 *
 * Provides:
 * - Enter/exit replay mode
 * - Scrub to any tick in the event timeline
 * - Step forward/backward by individual events or by moves
 * - Auto-playback at configurable speed
 * - Export/import event trace packages
 *
 * When replay mode is active, the main store's world/agents/events/moves
 * are overridden with the replayed state at the current replay cursor.
 * All visualization components automatically react because they read from
 * the same Zustand store.
 */
import { create } from 'zustand';
import { RuntimeEvent, AgentTelemetry, WorldTelemetry, WorldStateNode } from '../lib/types';
import { useDashboardStore, MoveRecord, TelemetrySample } from '../state/useDashboardStore';
import { audioSynth } from '../lib/audio';

interface ReplaySnapshot {
  agents: Record<number, AgentTelemetry>;
  world: WorldTelemetry;
  events: RuntimeEvent[];   // events up to this point (reversed for UI)
  moves: MoveRecord[];
  timeline: WorldStateNode[];
}

export interface ReplayState {
  /** Whether we are in replay mode */
  isReplayMode: boolean;
  /** The full chronological event log for the replay session */
  replayLog: RuntimeEvent[];
  /** Current cursor index into replayLog */
  cursor: number;
  /** Playback speed multiplier (1 = 1 event per tick interval) */
  speed: number;
  /** Whether auto-playback is active */
  isPlaying: boolean;
  /** Timer ID for auto-playback */
  _playbackTimer: ReturnType<typeof setInterval> | null;
  /** Min/max ticks in the log */
  minTick: number;
  maxTick: number;
  /** Total events in log */
  totalEvents: number;

  // ── Actions ─────────────────────────────────
  enterReplay: (events?: RuntimeEvent[]) => void;
  exitReplay: () => void;
  seekToCursor: (cursor: number) => void;
  seekToTick: (tick: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
  nextMove: () => void;
  prevMove: () => void;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  exportTrace: () => string;
  importTrace: (json: string) => boolean;
}

const INITIAL_WORLD: WorldTelemetry = {
  tick: 0, simulationTimeMs: 0, speed: '1x', activeAgentIndex: null,
  turnNumber: 0, currentStateLabel: 'INITIAL', legalActions: []
};

/**
 * Reconstruct the full dashboard state from events[0..cursor].
 * This is the core replay computation — pure function of events.
 */
function replayToIndex(events: RuntimeEvent[], endIndex: number): ReplaySnapshot {
  const agents: Record<number, AgentTelemetry> = {};
  const world = { ...INITIAL_WORLD };
  const timeline: WorldStateNode[] = [];
  const moves: MoveRecord[] = [];
  const visibleEvents: RuntimeEvent[] = [];

  for (let i = 0; i <= endIndex && i < events.length; i++) {
    const event = events[i];
    visibleEvents.push(event);

    if (event.type === 'WORLD_STATE_UPDATED') {
      const data = event.data as any;
      if (typeof data.state === 'string') {
        const fen = data.state;
        const parts = fen.split(' ');
        const activeColor = parts[1] || 'w';
        const fullMove = parseInt(parts[5] || '1', 10);
        world.fen = fen;
        world.turnNumber = (fullMove - 1) * 2 + (activeColor === 'b' ? 1 : 0);
        world.activeAgentIndex = activeColor === 'w' ? 0 : 1;
      }
      world.tick = event.tick;
      world.simulationTimeMs = event.simulationTimeMs;
      world.stateHash = data.stateHash;
      timeline.push({
        id: event.eventId, parentId: event.causedByEventId,
        tick: event.tick, eventId: event.eventId,
        label: `Turn ${Math.floor(world.turnNumber / 2) + 1}`,
        stateHash: data.stateHash
      });
    }
    if (event.type === 'AGENT_THINKING') {
      const idx = event.data.agentIndex as number;
      if (!agents[idx]) agents[idx] = {} as AgentTelemetry;
      agents[idx].lifecycle = 'THINKING';
    }
    if (event.type === 'INTENT_ACCEPTED') {
      const idx = event.data.agentIndex as number;
      if (!agents[idx]) agents[idx] = {} as AgentTelemetry;
      agents[idx].lifecycle = 'ACCEPTED';
      agents[idx].lastAction = event.data.action as string;
      const action = (event.data.action as string) || '';
      const turnIdx = Math.floor(world.turnNumber / 2);
      if (idx === 0) {
        const existing = moves.find(m => m.turnNumber === turnIdx + 1);
        if (existing) existing.whiteMove = action;
        else moves.push({ turnNumber: turnIdx + 1, whiteMove: action, blackMove: null, tick: event.tick });
      } else {
        const existing = moves.find(m => m.turnNumber === turnIdx + 1);
        if (existing) existing.blackMove = action;
        else moves.push({ turnNumber: turnIdx + 1, whiteMove: null, blackMove: action, tick: event.tick });
      }
    }
    if (event.type === 'INTENT_REJECTED') {
      const idx = event.data.agentIndex as number;
      if (!agents[idx]) agents[idx] = {} as AgentTelemetry;
      agents[idx].lifecycle = 'REJECTED';
    }
  }

  return {
    agents, world, timeline, moves,
    events: [...visibleEvents].reverse().slice(0, 500),
  };
}

function applySnapshot(snapshot: ReplaySnapshot) {
  useDashboardStore.setState({
    agents: snapshot.agents,
    world: snapshot.world,
    events: snapshot.events,
    moves: snapshot.moves,
    timeline: snapshot.timeline,
    simulationState: 'paused', // show as paused in replay mode
  });
}

export const useReplayStore = create<ReplayState>((set, get) => ({
  isReplayMode: false,
  replayLog: [],
  cursor: 0,
  speed: 1,
  isPlaying: false,
  _playbackTimer: null,
  minTick: 0,
  maxTick: 0,
  totalEvents: 0,

  enterReplay: (externalEvents) => {
    const store = useDashboardStore.getState();
    // Use external events or reconstruct from store's reverse-ordered events
    const log = externalEvents
      ? [...externalEvents].sort((a, b) => a.sequence - b.sequence)
      : [...store.events].reverse(); // store.events are reverse-chrono, so reverse to chrono

    if (log.length === 0) return;

    const lastIdx = log.length - 1;
    const snapshot = replayToIndex(log, lastIdx);

    set({
      isReplayMode: true,
      replayLog: log,
      cursor: lastIdx,
      minTick: log[0].tick,
      maxTick: log[lastIdx].tick,
      totalEvents: log.length,
      isPlaying: false,
    });
    applySnapshot(snapshot);
  },

  exitReplay: () => {
    const timer = get()._playbackTimer;
    if (timer) clearInterval(timer);
    set({
      isReplayMode: false, replayLog: [], cursor: 0,
      isPlaying: false, _playbackTimer: null,
    });
    // The live socket stream will resume updating the store naturally
  },

  seekToCursor: (cursor) => {
    const { replayLog, isPlaying, speed } = get();
    const clamped = Math.max(0, Math.min(cursor, replayLog.length - 1));
    const snapshot = replayToIndex(replayLog, clamped);

    // Play sound effects during replay scrubbing/playback
    const event = replayLog[clamped];
    if (event) {
      const allowTick = !isPlaying || speed <= 2;
      if (event.type === 'WORLD_STATE_UPDATED') {
        if (allowTick) audioSynth.playTick();
      } else if (event.type === 'INTENT_ACCEPTED') {
        if (allowTick) audioSynth.playSuccess();
      } else if (event.type === 'INTENT_REJECTED' || event.type === 'INTENT_STALE_REJECTED') {
        audioSynth.playError();
      } else if (event.type === 'AGENT_THINKING') {
        if (allowTick) audioSynth.playThink();
      }
    }

    set({ cursor: clamped });
    applySnapshot(snapshot);
  },

  seekToTick: (targetTick) => {
    const { replayLog } = get();
    // Binary search for the last event at or before targetTick
    let lo = 0, hi = replayLog.length - 1, best = 0;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (replayLog[mid].tick <= targetTick) { best = mid; lo = mid + 1; }
      else { hi = mid - 1; }
    }
    get().seekToCursor(best);
  },

  stepForward: () => {
    const { cursor, replayLog } = get();
    if (cursor < replayLog.length - 1) get().seekToCursor(cursor + 1);
  },

  stepBackward: () => {
    const { cursor } = get();
    if (cursor > 0) get().seekToCursor(cursor - 1);
  },

  nextMove: () => {
    const { cursor, replayLog } = get();
    // Find the next WORLD_STATE_UPDATED after current cursor
    for (let i = cursor + 1; i < replayLog.length; i++) {
      if (replayLog[i].type === 'WORLD_STATE_UPDATED') {
        get().seekToCursor(i);
        return;
      }
    }
  },

  prevMove: () => {
    const { cursor, replayLog } = get();
    // Find the previous WORLD_STATE_UPDATED before current cursor
    for (let i = cursor - 1; i >= 0; i--) {
      if (replayLog[i].type === 'WORLD_STATE_UPDATED') {
        get().seekToCursor(i);
        return;
      }
    }
  },

  play: () => {
    const { isPlaying, _playbackTimer, speed } = get();
    if (isPlaying) return;
    if (_playbackTimer) clearInterval(_playbackTimer);

    const interval = Math.max(50, 500 / speed);
    const timer = setInterval(() => {
      const { cursor, replayLog } = get();
      if (cursor >= replayLog.length - 1) {
        get().pause();
        return;
      }
      get().seekToCursor(cursor + 1);
    }, interval);

    set({ isPlaying: true, _playbackTimer: timer });
  },

  pause: () => {
    const timer = get()._playbackTimer;
    if (timer) clearInterval(timer);
    set({ isPlaying: false, _playbackTimer: null });
  },

  setSpeed: (speed) => {
    const { isPlaying } = get();
    set({ speed });
    // Restart playback with new speed if playing
    if (isPlaying) {
      get().pause();
      get().play();
    }
  },

  exportTrace: () => {
    const store = useDashboardStore.getState();
    const { replayLog, isReplayMode } = get();
    const events = isReplayMode ? replayLog : [...store.events].reverse();
    const pkg = {
      version: 1,
      name: `neural-arena-trace-${Date.now()}`,
      exportedAt: new Date().toISOString(),
      eventCount: events.length,
      events,
    };
    return JSON.stringify(pkg);
  },

  importTrace: (json: string) => {
    try {
      const pkg = JSON.parse(json);
      if (!pkg.events || !Array.isArray(pkg.events)) return false;
      get().enterReplay(pkg.events);
      return true;
    } catch {
      return false;
    }
  },
}));
