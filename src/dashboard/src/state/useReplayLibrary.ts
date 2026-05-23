/**
 * useReplayLibrary — Replay library management with localStorage storage.
 * 
 * Stores replay index and event data separately for fast listing.
 * Works in both Electron and browser environments.
 */
import { create } from 'zustand';
import { RuntimeEvent } from '../lib/types';
import { Chess } from 'chess.js';


export interface ReplayEntry {
  id: string;
  name: string;
  createdAt: string;
  eventCount: number;
  moveCount: number;
  durationTicks: number;
  agents: { white: string; black: string };
  result: 'checkmate' | 'stalemate' | 'draw' | 'timeout' | 'in-progress' | 'unknown';
  tags: string[];
  sizeBytes: number;
}

interface ReplayLibraryState {
  entries: ReplayEntry[];
  isLoading: boolean;

  loadLibrary: () => void;
  saveReplay: (name: string, events: RuntimeEvent[], metadata?: Partial<ReplayEntry>) => string;
  deleteReplay: (id: string) => void;
  renameReplay: (id: string, name: string) => void;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
  getReplayEvents: (id: string) => RuntimeEvent[] | null;
  exportReplay: (id: string) => string | null;
  importReplay: (json: string) => boolean;
}

const INDEX_KEY = 'na_replay_index';
const DATA_PREFIX = 'na_replay_data_';

function generateId(): string {
  return `replay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadIndex(): ReplayEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveIndex(entries: ReplayEntry[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
  } catch { /* storage full */ }
}

function saveEventData(id: string, events: RuntimeEvent[]) {
  try {
    localStorage.setItem(DATA_PREFIX + id, JSON.stringify(events));
  } catch { /* storage full */ }
}

function loadEventData(id: string): RuntimeEvent[] | null {
  try {
    const raw = localStorage.getItem(DATA_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function deleteEventData(id: string) {
  localStorage.removeItem(DATA_PREFIX + id);
}

function generatePreseededEvents(
  whiteName: string,
  blackName: string,
  moves: string[]
): { events: RuntimeEvent[]; moveCount: number; result: ReplayEntry['result'] } {
  const chess = new Chess();
  const events: RuntimeEvent[] = [];
  let sequence = 0;
  let tick = 0;

  const createEvent = (type: string, data: Record<string, unknown>): RuntimeEvent => {
    sequence++;
    tick += 5;
    return {
      eventId: `seed-${Date.now()}-${sequence}-${Math.random().toString(36).slice(2, 6)}`,
      sequence,
      type,
      tick,
      simulationTimeMs: tick * 100,
      wallTimestampMs: Date.now() - (moves.length * 4 - sequence) * 1000,
      causedByEventId: null,
      data,
      version: 1,
    };
  };

  events.push(createEvent('SIMULATION_STARTED', {
    config: {
      maxMoves: 100,
      agents: [
        { name: whiteName, model: 'google/gemma-3n-e4b-it', provider: 'google', index: 0 },
        { name: blackName, model: 'deepseek/deepseek-r1', provider: 'deepseek', index: 1 },
      ]
    }
  }));

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const isWhite = i % 2 === 0;
    const agentIndex = isWhite ? 0 : 1;

    events.push(createEvent('AGENT_THINKING', {
      agentIndex,
      turnNumber: Math.floor(i / 2) + 1,
      model: isWhite ? 'google/gemma-3n-e4b-it' : 'deepseek/deepseek-r1',
    }));

    events.push(createEvent('ANTICHEAT_PASS', {
      agentIndex,
      parsedAction: move,
      normalizationStrategy: 'DIRECT_PARSE',
    }));

    events.push(createEvent('INTENT_ACCEPTED', {
      agentIndex,
      action: move,
      turnNumber: Math.floor(i / 2) + 1,
    }));

    try {
      chess.move(move);
    } catch {
      try {
        chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move.slice(4) || undefined });
      } catch {
        // no-op
      }
    }

    events.push(createEvent('WORLD_STATE_UPDATED', {
      state: chess.fen(),
      stateHash: Math.random().toString(36).slice(2, 10),
      turnNumber: Math.floor(i / 2) + 1,
    }));
  }

  let result: ReplayEntry['result'] = 'unknown';
  if (chess.isCheckmate()) {
    result = 'checkmate';
  } else if (chess.isStalemate()) {
    result = 'stalemate';
  } else if (chess.isDraw()) {
    result = 'draw';
  }

  events.push(createEvent('SIMULATION_STOPPED', {
    reason: chess.isGameOver() ? 'game_over' : 'manual',
    result,
  }));

  return {
    events,
    moveCount: Math.ceil(moves.length / 2),
    result,
  };
}


export const useReplayLibrary = create<ReplayLibraryState>((set, get) => ({
  entries: [],
  isLoading: false,

  loadLibrary: () => {
    set({ isLoading: true });
    let entries = loadIndex();
    if (entries.length === 0) {
      const operaMoves = [
        'e4', 'e5', 'Nf3', 'd6', 'd4', 'Bg4', 'dxe5', 'Bxf3', 'Qxf3', 'dxe5', 'Bc4', 'Nf6', 'Qb3', 'Qe7', 'Nc3', 'c6', 'Bg5', 'b5', 'Nxb5', 'cxb5', 'Bxb5+', 'Nbd7', 'O-O-O', 'Rd8', 'Rxd7', 'Rxd7', 'Rd1', 'Qe6', 'Bxd7+', 'Nxd7', 'Qb8+', 'Nxb8', 'Rd8#'
      ];
      const deepBlueMoves = [
        'e4', 'c5', 'c3', 'd5', 'exd5', 'Qxd5', 'd4', 'Nf6', 'Nf3', 'Bg4', 'Be2', 'e6', 'h3', 'Bh5', 'O-O', 'Nc6', 'Be3', 'cxd4', 'cxd4', 'Bb4', 'a3', 'Ba5', 'Nc3', 'Qd6', 'Nb5', 'Qe7', 'Ne5', 'Bxe2', 'Qxe2', 'O-O', 'Rac1', 'Rac8', 'Bg5', 'Bb6', 'Bxf6', 'gxf6', 'Nc4', 'Rfd8', 'Nxb6', 'axb6', 'Rfd1', 'f5', 'Qe3', 'Qf6', 'd5', 'Rxd5', 'Rxd5', 'exd5', 'b3', 'Kh8', 'Qxb6', 'Rg8', 'Qc5', 'd4', 'Nd6', 'f4', 'Nxb7', 'Ne5', 'Qd5', 'f3', 'g3', 'Nd3', 'Rc7', 'Re8', 'Nd6', 'Re1+', 'Kh2', 'Nxf2', 'Nxf7+', 'Kg7', 'Ng5+', 'Kh6', 'Rxh7+', 'Kg6', 'Qg8+', 'Kf5', 'Nxf3', 'Rh1+', 'Kg2', 'Ke4', 'Nd2+', 'Kd3', 'Qc4+', 'Kxd2', 'Rf7'
      ];
      const evergreenMoves = [
        'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Ba5', 'd4', 'exd4', 'O-O', 'd3', 'Qb3', 'Qf6', 'e5', 'Qg6', 'Re1', 'Nge7', 'Ba3', 'b5', 'Qxb5', 'Rb8', 'Qa4', 'Bb6', 'Nbd2', 'Bb7', 'Ne4', 'Qf5', 'Bxd3', 'Qh5', 'Nf6+', 'gxf6', 'exf6', 'Rg8', 'Rad1', 'Qxf3', 'Rxe7+', 'Nxe7', 'Qxd7+', 'Kxd7', 'Bf5+', 'Ke8', 'Bd7+', 'Kf8', 'Bxe7#'
      ];

      const seeds = [
        {
          name: "Morphy's Opera Game (1858)",
          white: "Paul Morphy",
          black: "Duke Karl / Count Isouard",
          moves: operaMoves,
          tags: ["historical", "classic", "checkmate"],
        },
        {
          name: "Kasparov vs. Deep Blue (1996, Game 1)",
          white: "Deep Blue",
          black: "Garry Kasparov",
          moves: deepBlueMoves,
          tags: ["historical", "man-vs-machine", "deep-blue"],
        },
        {
          name: "The Evergreen Game (1852)",
          white: "Adolf Anderssen",
          black: "Jean Dufresne",
          moves: evergreenMoves,
          tags: ["historical", "classic", "evergreen"],
        }
      ];

      entries = seeds.map(s => {
        const { events, moveCount, result } = generatePreseededEvents(s.white, s.black, s.moves);
        const id = `replay-seed-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const json = JSON.stringify(events);
        const entry: ReplayEntry = {
          id,
          name: s.name,
          createdAt: new Date().toISOString(),
          eventCount: events.length,
          moveCount,
          durationTicks: events.length > 0 ? events[events.length - 1].tick - events[0].tick : 0,
          agents: { white: s.white, black: s.black },
          result,
          tags: s.tags,
          sizeBytes: json.length,
        };
        saveEventData(id, events);
        return entry;
      });

      saveIndex(entries);
    }
    set({ entries, isLoading: false });
  },


  saveReplay: (name, events, metadata = {}) => {
    const id = generateId();
    const json = JSON.stringify(events);
    const entry: ReplayEntry = {
      name,
      eventCount: events.length,
      moveCount: metadata.moveCount ?? 0,
      durationTicks: events.length > 0 ? events[events.length - 1].tick - events[0].tick : 0,
      agents: metadata.agents ?? { white: 'Agent 0', black: 'Agent 1' },
      result: metadata.result ?? 'unknown',
      tags: metadata.tags ?? [],
      sizeBytes: json.length,
      ...metadata,
      id, // ensure id isn't overridden and doesn't trigger duplicate key warning
      createdAt: metadata.createdAt ?? new Date().toISOString(),
    };

    saveEventData(id, events);
    const entries = [...get().entries, entry];
    saveIndex(entries);
    set({ entries });
    return id;
  },

  deleteReplay: (id) => {
    deleteEventData(id);
    const entries = get().entries.filter(e => e.id !== id);
    saveIndex(entries);
    set({ entries });
  },

  renameReplay: (id, name) => {
    const entries = get().entries.map(e => e.id === id ? { ...e, name } : e);
    saveIndex(entries);
    set({ entries });
  },

  addTag: (id, tag) => {
    const entries = get().entries.map(e =>
      e.id === id && !e.tags.includes(tag) ? { ...e, tags: [...e.tags, tag] } : e
    );
    saveIndex(entries);
    set({ entries });
  },

  removeTag: (id, tag) => {
    const entries = get().entries.map(e =>
      e.id === id ? { ...e, tags: e.tags.filter(t => t !== tag) } : e
    );
    saveIndex(entries);
    set({ entries });
  },

  getReplayEvents: (id) => loadEventData(id),

  exportReplay: (id) => {
    const entry = get().entries.find(e => e.id === id);
    const events = loadEventData(id);
    if (!entry || !events) return null;
    return JSON.stringify({
      version: 1,
      name: entry.name,
      exportedAt: new Date().toISOString(),
      metadata: entry,
      eventCount: events.length,
      events,
    });
  },

  importReplay: (json) => {
    try {
      const pkg = JSON.parse(json);
      if (!pkg.events || !Array.isArray(pkg.events)) return false;
      const name = pkg.name || pkg.metadata?.name || `Imported Replay`;
      get().saveReplay(name, pkg.events, pkg.metadata || {});
      return true;
    } catch { return false; }
  },
}));
