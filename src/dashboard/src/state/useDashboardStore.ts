import { create } from 'zustand';
import { RuntimeEvent, ConnectionStatus, AgentTelemetry, WorldTelemetry, WorldStateNode } from '../lib/types';
import { audioSynth } from '../lib/audio';

export interface MoveRecord {
  turnNumber: number;
  whiteMove: string | null;
  blackMove: string | null;
  tick: number;
}

export interface TelemetrySample {
  tick: number;
  simulationTimeMs: number;
  eventRate: number;        // events per tick window
  cognitionEvents: number;  // cognition-related events in window
  errorEvents: number;      // error/rejection events in window
}

interface DashboardState {
  connectionStatus: ConnectionStatus;
  simulationState: 'configuring' | 'running' | 'paused' | 'stopped';
  events: RuntimeEvent[];
  agents: Record<number, AgentTelemetry>;
  world: WorldTelemetry;
  timeline: WorldStateNode[];
  moves: MoveRecord[];
  telemetrySamples: TelemetrySample[];
  isMuted: boolean;
  activeTab: 'dashboard' | 'replay' | 'telemetry' | 'settings';
  
  setConnectionStatus: (status: ConnectionStatus) => void;
  setSimulationState: (state: 'configuring' | 'running' | 'paused' | 'stopped') => void;
  addEvent: (event: RuntimeEvent) => void;
  hydrateHistory: (events: RuntimeEvent[]) => void;
  clearEvents: () => void;
  toggleMute: () => void;
  setActiveTab: (tab: 'dashboard' | 'replay' | 'telemetry' | 'settings') => void;
}

const INITIAL_WORLD: WorldTelemetry = {
  tick: 0,
  simulationTimeMs: 0,
  speed: '1x',
  activeAgentIndex: null,
  turnNumber: 0,
  currentStateLabel: 'INITIAL',
  legalActions: []
};

// Track internal counters for telemetry sampling
let _eventCounter = 0;
let _cognitionCounter = 0;
let _errorCounter = 0;
let _lastSampleTick = 0;
const SAMPLE_INTERVAL = 50; // Sample every ~50 ticks

function isCognitionEvent(type: string): boolean {
  return type.includes('COGNITIVE') || type.includes('CONTEXT') || type.includes('PROMPT') ||
         type.includes('FSM') || type.includes('STRATEGY') || type.includes('MEMORY_BLOCK') ||
         type.includes('PERSONA_BLOCK') || type.includes('CONSTRAINT_BLOCK');
}

function isErrorEvent(type: string): boolean {
  return type.includes('REJECTED') || type.includes('ERROR') || type.includes('FAIL') ||
         type.includes('ILLEGAL') || type.includes('VIOLATION');
}

const initialMuted = typeof localStorage !== 'undefined' ? localStorage.getItem('na_muted') === 'true' : false;
audioSynth.isMuted = initialMuted;

export const useDashboardStore = create<DashboardState>((set) => ({
  connectionStatus: 'offline',
  simulationState: 'configuring',
  events: [],
  agents: {},
  world: INITIAL_WORLD,
  timeline: [],
  moves: [],
  telemetrySamples: [],
  isMuted: initialMuted,
  activeTab: 'dashboard',

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setSimulationState: (state) => set((storeState) => {
    const prev = storeState.simulationState;
    if (prev !== state) {
      if (state === 'running') {
        audioSynth.playStart();
      } else if (state === 'paused' || state === 'stopped') {
        audioSynth.playStop();
      }
    }
    return { simulationState: state };
  }),
  
  addEvent: (event) => set((state) => {
    const newEvents = [event, ...state.events].slice(0, 1000);
    
    const agents = { ...state.agents };
    let world = { ...state.world };
    const timeline = [...state.timeline];
    const moves = [...state.moves];
    let telemetrySamples = state.telemetrySamples;

    // Track counters for telemetry
    _eventCounter++;
    if (isCognitionEvent(event.type)) _cognitionCounter++;
    if (isErrorEvent(event.type)) _errorCounter++;

    if (event.type === 'SIMULATION_STARTED') {
      audioSynth.playStart();
    }

    if (event.type === 'SIMULATION_STOPPED') {
      audioSynth.playStop();
    }

    if (event.type === 'WORLD_STATE_UPDATED') {
      audioSynth.playTick();
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
      
      timeline.push({
        id: event.eventId,
        parentId: event.causedByEventId,
        tick: event.tick,
        eventId: event.eventId,
        label: `Turn ${Math.floor(world.turnNumber / 2) + 1}`,
        stateHash: data.stateHash
      });
    }

    if (event.type === 'AGENT_THINKING') {
      audioSynth.playThink();
      const idx = event.data.agentIndex as number;
      if (!agents[idx]) agents[idx] = {} as AgentTelemetry;
      agents[idx].lifecycle = 'THINKING';
    }

    if (event.type === 'INTENT_ACCEPTED') {
      audioSynth.playSuccess();
      const idx = event.data.agentIndex as number;
      if (!agents[idx]) agents[idx] = {} as AgentTelemetry;
      agents[idx].lifecycle = 'ACCEPTED';
      agents[idx].lastAction = event.data.action as string;

      // Record move
      const action = (event.data.action as string) || '';
      const turnIdx = Math.floor(world.turnNumber / 2);
      
      if (idx === 0) {
        // White move
        const existing = moves.find(m => m.turnNumber === turnIdx + 1);
        if (existing) {
          existing.whiteMove = action;
        } else {
          moves.push({ turnNumber: turnIdx + 1, whiteMove: action, blackMove: null, tick: event.tick });
        }
      } else {
        // Black move
        const existing = moves.find(m => m.turnNumber === turnIdx + 1);
        if (existing) {
          existing.blackMove = action;
        } else {
          moves.push({ turnNumber: turnIdx + 1, whiteMove: null, blackMove: action, tick: event.tick });
        }
      }
    }

    if (event.type === 'INTENT_REJECTED' || event.type === 'INTENT_STALE_REJECTED') {
      audioSynth.playError();
      const idx = event.data.agentIndex as number;
      if (!agents[idx]) agents[idx] = {} as AgentTelemetry;
      agents[idx].lifecycle = 'REJECTED';
    }

    // Sample telemetry periodically
    if (event.tick - _lastSampleTick >= SAMPLE_INTERVAL && event.tick > 0) {
      telemetrySamples = [...telemetrySamples, {
        tick: event.tick,
        simulationTimeMs: event.simulationTimeMs,
        eventRate: _eventCounter,
        cognitionEvents: _cognitionCounter,
        errorEvents: _errorCounter,
      }].slice(-100); // Keep last 100 samples
      _eventCounter = 0;
      _cognitionCounter = 0;
      _errorCounter = 0;
      _lastSampleTick = event.tick;
    }

    return { events: newEvents, agents, world, timeline, moves, telemetrySamples };
  }),

  hydrateHistory: (historyEvents) => set((state) => {
    const reversedEvents = [...historyEvents].reverse();
    
    const agents: Record<number, AgentTelemetry> = {};
    const world = { ...INITIAL_WORLD };
    const timeline: WorldStateNode[] = [];
    const moves: MoveRecord[] = [];
    const telemetrySamples: TelemetrySample[] = [];

    let evCount = 0;
    let cogCount = 0;
    let errCount = 0;
    let lastTick = 0;

    for (const event of historyEvents) {
      evCount++;
      if (isCognitionEvent(event.type)) cogCount++;
      if (isErrorEvent(event.type)) errCount++;

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
        
        timeline.push({
          id: event.eventId,
          parentId: event.causedByEventId,
          tick: event.tick,
          eventId: event.eventId,
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
          if (existing) { existing.whiteMove = action; }
          else { moves.push({ turnNumber: turnIdx + 1, whiteMove: action, blackMove: null, tick: event.tick }); }
        } else {
          const existing = moves.find(m => m.turnNumber === turnIdx + 1);
          if (existing) { existing.blackMove = action; }
          else { moves.push({ turnNumber: turnIdx + 1, whiteMove: null, blackMove: action, tick: event.tick }); }
        }
      }

      if (event.type === 'INTENT_REJECTED') {
        const idx = event.data.agentIndex as number;
        if (!agents[idx]) agents[idx] = {} as AgentTelemetry;
        agents[idx].lifecycle = 'REJECTED';
      }

      // Sample telemetry
      if (event.tick - lastTick >= SAMPLE_INTERVAL && event.tick > 0) {
        telemetrySamples.push({
          tick: event.tick,
          simulationTimeMs: event.simulationTimeMs,
          eventRate: evCount,
          cognitionEvents: cogCount,
          errorEvents: errCount,
        });
        evCount = 0; cogCount = 0; errCount = 0;
        lastTick = event.tick;
      }
    }

    // Reset global counters after hydration
    _eventCounter = 0;
    _cognitionCounter = 0;
    _errorCounter = 0;
    _lastSampleTick = world.tick;

    return { events: reversedEvents, agents, world, timeline, moves, telemetrySamples: telemetrySamples.slice(-100) };
  }),

  clearEvents: () => set({ events: [], moves: [], telemetrySamples: [] }),

  toggleMute: () => set((state) => {
    const nextMuted = !state.isMuted;
    audioSynth.isMuted = nextMuted;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('na_muted', String(nextMuted));
    }
    return { isMuted: nextMuted };
  }),

  setActiveTab: (tab) => set({ activeTab: tab })
}));
