/**
 * useRuntimePulse — Derives animation intensity from live runtime state.
 * 
 * This hook reads the Zustand store and computes deterministic animation
 * parameters that reflect the true state of the simulation engine.
 * All values are derived from store state — no random generators, no
 * uncontrolled intervals.
 */
import { useMemo } from 'react';
import { useDashboardStore } from '../state/useDashboardStore';

export interface RuntimePulse {
  /** 0.0 – 1.0: overall engine activity intensity */
  intensity: number;
  /** Whether any agent is actively thinking */
  isThinking: boolean;
  /** 0 = white active, 1 = black active, null = idle */
  activeAgentIndex: number | null;
  /** Recent event rate (events in last ~20 entries) per category */
  cognitionHeat: number;
  intentHeat: number;
  worldHeat: number;
  /** Whether the engine is paused or stopped */
  isPaused: boolean;
  isStopped: boolean;
  isRunning: boolean;
  /** The current tick — used for deterministic animation phase */
  tick: number;
  /** Turn number — used for move pulse triggers */
  turnNumber: number;
  /** Last event type — used for transient reactions */
  lastEventType: string | null;
  /** Error/rejection pressure (0.0 – 1.0) */
  errorPressure: number;
}

const CATEGORY_WINDOW = 20; // Look at last N events for heat calculation

export function useRuntimePulse(): RuntimePulse {
  const simulationState = useDashboardStore((s) => s.simulationState);
  const agents = useDashboardStore((s) => s.agents);
  const world = useDashboardStore((s) => s.world);
  const events = useDashboardStore((s) => s.events);

  return useMemo(() => {
    const isRunning = simulationState === 'running';
    const isPaused = simulationState === 'paused';
    const isStopped = simulationState === 'stopped' || simulationState === 'configuring';

    const isThinking = Object.values(agents).some(a => a?.lifecycle === 'THINKING');
    const activeAgentIndex = world.activeAgentIndex;

    // Compute event heat from recent events
    const recentEvents = events.slice(0, CATEGORY_WINDOW);
    let cognitionCount = 0;
    let intentCount = 0;
    let worldCount = 0;
    let errorCount = 0;

    for (const ev of recentEvents) {
      const t = ev.type;
      if (t.includes('COGNITIVE') || t.includes('CONTEXT') || t.includes('PROMPT') || t.includes('FSM') || t.includes('STRATEGY')) {
        cognitionCount++;
      }
      if (t.includes('INTENT') || t.includes('ANTICHEAT')) {
        intentCount++;
        if (t.includes('REJECTED') || t.includes('FAIL')) errorCount++;
      }
      if (t.includes('WORLD') || t === 'TICK') {
        worldCount++;
      }
      if (t.includes('ERROR') || t.includes('REJECTED') || t.includes('FAIL')) {
        errorCount++;
      }
    }

    const cognitionHeat = Math.min(1, cognitionCount / CATEGORY_WINDOW);
    const intentHeat = Math.min(1, intentCount / CATEGORY_WINDOW);
    const worldHeat = Math.min(1, worldCount / CATEGORY_WINDOW);
    const errorPressure = Math.min(1, errorCount / (CATEGORY_WINDOW * 0.3));

    // Overall intensity: combination of thinking state and event frequency
    let intensity = 0;
    if (isRunning) {
      intensity = 0.3; // Base running intensity
      if (isThinking) intensity += 0.35;
      intensity += cognitionHeat * 0.2;
      intensity += intentHeat * 0.15;
    } else if (isPaused) {
      intensity = 0.1; // Dormant but present
    }
    intensity = Math.min(1, intensity);

    const lastEventType = recentEvents.length > 0 ? recentEvents[0].type : null;

    return {
      intensity,
      isThinking,
      activeAgentIndex,
      cognitionHeat,
      intentHeat,
      worldHeat,
      isPaused,
      isStopped,
      isRunning,
      tick: world.tick,
      turnNumber: world.turnNumber,
      lastEventType,
      errorPressure,
    };
  }, [simulationState, agents, world.activeAgentIndex, world.tick, world.turnNumber, events]);
}
