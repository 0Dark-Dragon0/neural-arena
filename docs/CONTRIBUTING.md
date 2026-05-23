# Contributing to Neural Arena: Guidelines and Architecture Contract

Thank you for your interest in contributing to Neural Arena. 

Before writing code, please read this document. Neural Arena’s competitive edge relies on strict architectural invariants. Pull requests that break these requirements will be rejected.

---

## 1. The Architecture Invariants Contract

Any contribution to Neural Arena must adhere to the following six engineering invariants:

```
┌───────────────────────────────────────────────────────────────────┐
│                     Platform Invariant Moats                      │
│ ├─────────────────┬─────────────────┬─────────────────────────────┤
│ │ Deterministic   │ Immutable Event │ Causal provenances          │
│ │ State Machine   │ Log Storage     │ (causedByEventId)           │
│ ├─────────────────┼─────────────────┼─────────────────────────────┤
│ │ Domain-Agnostic │ Zero Local Time │ Pure State                  │
│ │ Engine Design   │ Dependencies    │ Reconstruction Functions    │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

* **Deterministic State Machine**: Given the same inputs, the simulation loop must yield identical results. No thread scheduler, network jitter, or system clock call is allowed to influence execution.
* **Immutable Event Log Storage**: Events dispatched via the `EventBus` are deep-frozen. Once written, they cannot be modified.
* **Causal Provenance**: All events must include a `causedByEventId` pointer to establish an unbroken causal chain.
* **Domain-Agnostic Engine Design**: The core engine (including the `EventBus`, `EventStore`, and `SimulationClock`) must remain decoupled from specific simulation rules (e.g., Chess rules).
* **Zero Local Time Dependencies**: Simulation time is computed using ticks, not physical wall-clock milliseconds. The `SimulationClock` handles these calculations.
* **Pure State Reconstruction Functions**: The replay engine uses a pure `replayToIndex(events, cursor)` function. It does not read external state and must always yield identical output for the same input.

---

## 2. Strict Coding Standards

### A. TypeScript Type Safety
The repository enforces strict TypeScript rules. The compiler uses `strict: true` settings.
* **No `any`**: The use of `any` is forbidden. Use `unknown` or specify explicit type unions if the format is unpredictable.
* **No Type Casting Assertions (`as CustomType`)**: Avoid casting checks unless dealing with third-party JSON parser outcomes. Use type guards (`isCustomType`) instead.
* **No Ignore Comments**: Suppressing compilation checks using `@ts-ignore` or `@ts-nocheck` is not permitted. Fix the underlying type signature instead.

### B. React Components and Performance
The Mission Control Dashboard displays thousands of live updates per minute. UI code must be optimized for rendering efficiency:
* **React.memo wrapping**: All dashboard panels (e.g. Move history, event logs, charts) must be wrapped in `React.memo` to prevent parent updates from triggering full re-renders.
* **Isolate Zustand selectors**: Never import the entire Zustand state object inside a component. Select only the necessary primitive variables to minimize re-render triggers:
  ```typescript
  // Correct
  const isPaused = useDashboardStore(state => state.isPaused);
  
  // Incorrect
  const { isPaused, startSimulation } = useDashboardStore();
  ```
* **Use Virtualized Lists**: Lists showing event logs or history streams must use `@tanstack/react-virtual` to preserve browser memory and frame rates.

### C. Tailwind CSS Styling Rules
Neural Arena uses a tailored design token system for a dark, futuristic look.
* **Do not use arbitrary spacing or color utilities**: Avoid utilities like `bg-[#1a2b3c]` or `p-[13px]`. Use the predefined tokens in `tailwind.config.js` (e.g. `bg-background-dark`, `p-input`, `text-telemetry-cyan`).
* **Maintain Dual-Runtime Compatibility**: Styling should dynamically scale for both browser-based viewport layouts and desktop Electron borders.

---

## 3. Pull Request Review Checklist

Before creating a pull request, complete this validation list locally:

### 1. Verification Commands
Run the verification commands inside the workspace root:
```bash
# Verify TypeScript compilation runs clean with zero errors
npx tsc --noEmit

# Verify dashboard production bundle compiles successfully
npm run dashboard:build
```

### 2. Verification of Determinism
If modifying the simulation engine, perform a determinism check:
1. Run a 100-tick simulation match.
2. Export the session event history using the Dashboard's **Export** utility.
3. Import the `.neural-arena.json` event log inside the **Replay Panel**.
4. Step through the timeline scrubber tick-by-tick and verify that the client state, move history, and logs match the original simulation run.

### 3. Submission Format
* Commit messages must use the standard conventional commits format (e.g. `feat(cognition): add Level 4 minimal prompt strategy`).
* Diffs must not include sensitive variables, API keys, or personal configurations in environmental files (e.g. `.env`).
