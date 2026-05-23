# Replay Format Specification

Neural Arena replay files use the `.neural-arena.json` extension and contain a complete, deterministic record of a simulation session. 

---

## 1. File Structure Schema

A replay file consists of a single JSON block encapsulating session metadata, agent profile configurations, and the chronological array of runtime events.

```json
{
  "version": 1,
  "name": "gemma-speed-run-2026-05-21",
  "exportedAt": "2026-05-21T10:00:00.000Z",
  "eventCount": 847,
  "metadata": {
    "id": "replay-1716266400000-abc123",
    "moveCount": 42,
    "durationTicks": 842,
    "agents": { 
      "white": "llama-3-70b-instruct", 
      "black": "gemma-2-9b-it" 
    },
    "result": "checkmate",
    "tags": ["benchmark", "rapid"]
  },
  "events": [
    {
      "eventId": "evt-01",
      "type": "SIMULATION_STARTED",
      "tick": 0,
      "simulationTimeMs": 0,
      "sequence": 1,
      "data": {
        "domain": "chess",
        "tickRateMs": 100
      }
    }
  ]
}
```

### TypeScript Definition
```typescript
export interface ReplayArchive {
  version: number;
  name: string;
  exportedAt: string;
  eventCount: number;
  metadata: {
    id: string;
    moveCount: number;
    durationTicks: number;
    agents: { white: string; black: string };
    result: 'checkmate' | 'stalemate' | 'draw' | 'timeout' | 'in-progress' | 'unknown';
    tags: string[];
    sizeBytes?: number;
  };
  events: RuntimeEvent[];
}
```

---

## 2. Event Type Catalog

Every event inside the `events` array follows the uniform `RuntimeEvent` schema (defined in `ARCHITECTURE.md`), carrying a distinct event type key:

### A. World Events
* `SIMULATION_STARTED`: Emitted on engine initialization. `data` contains domain selection and setup clock bounds.
* `SIMULATION_STOPPED`: Emitted on game-over or manual stop commands. `data` logs the `reason` (e.g. checkmate, timeout).
* `TICK_ADVANCED`: Emitted by the SimulationClock when a logical cycle completes. `data` contains active `tick` index.
* `WORLD_STATE_UPDATED`: Authoritative state mutation event. `data` includes state representation (e.g. FEN) and the SHA-256 state hash.

### B. Agent Lifecycle Events
* `AGENT_THINKING`: Indicates an agent has gained turn priority and started decision workflows.
* `INTENT_ACCEPTED`: Emitted when the gateway approves a submitted agent move. `data` details move parameters.
* `INTENT_REJECTED`: Emitted when validation fails. `data` contains error messages and rejection class categories.
* `AGENT_ERROR`: Logs execution errors or connection drops.

### C. Cognition Events
* `CONTEXT_COMPILED`: Emitted after compiling the raw matrix inputs. `data` details tokens and payload layouts.
* `PROMPT_CONSTRUCTED`: Logs that the escalation engine has selected and formatted the prompt text.
* `COGNITIVE_CORRECTION_APPLIED`: Emitted when a rejection triggers correction injection on retries. `data` contains level details.
* `FSM_TRANSITION`: Logs internal agent scheduler FSM changes. `data` contains `from` and `to` states.

### D. LLM Provider Events
* `PROVIDER_REQUEST`: Dispatched when calling endpoints. `data` contains models, timeouts, and request tokens.
* `PROVIDER_RESPONSE`: Logs completion. `data` includes token consumption logs and response latencies.
* `PROVIDER_ERROR`: Logs API server errors, overloads, or connection time-outs.

---

## 3. Playback State Reconstruction

The dashboard does not store state frames chronologically. Instead, during playback scrubbing, the dashboard uses a pure function to compute the state dynamically:

$$\text{ReplayState}(E, c) = \text{applyEvents}(\text{InitialState}, E[0 \dots c])$$

### Mock Reconstruction Algorithm
Below is the logical workflow executing inside `useReplayStore.ts` when a user seeks to a specific cursor position `c`:

```typescript
export interface ReplayStateFrame {
  worldStateRepresentation: string;
  moveHistory: string[];
  cognitiveState: string;
  errorMessages: string[];
  activeAgentIndex: number;
}

export function reconstructState(events: RuntimeEvent[], cursor: number): ReplayStateFrame {
  // 1. Initialize clean state
  const state: ReplayStateFrame = {
    worldStateRepresentation: '',
    moveHistory: [],
    cognitiveState: 'IDLE',
    errorMessages: [],
    activeAgentIndex: 0
  };

  // 2. Iterate up to the cursor index
  const limit = Math.min(events.length - 1, cursor);
  for (let i = 0; i <= limit; i++) {
    const event = events[i];

    switch (event.type) {
      case 'WORLD_STATE_UPDATED':
        state.worldStateRepresentation = event.data.representation;
        break;
      
      case 'INTENT_ACCEPTED':
        state.moveHistory.push(event.data.action);
        state.errorMessages = []; // Clear current warnings
        break;
      
      case 'INTENT_REJECTED':
        state.errorMessages.push(`Rejection: ${event.data.reason}`);
        break;

      case 'FSM_TRANSITION':
        state.cognitiveState = event.data.to;
        break;

      case 'AGENT_THINKING':
        state.activeAgentIndex = event.data.agentIndex;
        break;
    }
  }

  return state;
}
```

---

## 4. Export & Import Execution Paths

* **Manual Export**: The dashboard dispatches a request to read the append-only array inside the `EventStore`. It structures the payload using the `ReplayArchive` schema and downloads it as a `.json` file to the disk.
* **Manual Import**: The user drags and drops a replay file into the dashboard. The client validates the file's JSON schema and structure:
  1. Checks if the `version` field is compatible.
  2. Ensures the `events` array contains sequential monotonic indices starting from sequence `1`.
  3. Feeds the event array to `useReplayStore.loadEvents(events)`.
  4. Triggers reconstruction for the initial frame, launching the scrubber UI.
* **Auto-Save Pipeline**: On the `SIMULATION_STOPPED` socket event, the client collects the event log, compiles metadata, and stores it in the local replay library using IndexedDB or filesystem operations.
