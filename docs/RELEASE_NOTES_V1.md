# Release Notes: Neural Arena v1.0.0-alpha.1

We are proud to announce the official release of **Neural Arena v1.0.0-alpha.1**. 

This release transitions Neural Arena from an experimental chess visualizer into a production-grade, local-first **Autonomous Cognition Observatory and Benchmarking Platform**.

---

## 1. Technical Feature Log

### A. Deterministic Simulation Core
The core runtime engine has been redesigned around **immutable event sourcing**:
* **EventStore**: An append-only log that captures all simulation steps. Every event is deep-frozen to prevent runtime state corruption.
* **WorldStateTree**: A hash-indexed state tracking system that hashes states at each transition.
* **Deterministic SimulationClock**: Separates simulation ticks from the physical system clock to ensure replay accuracy regardless of CPU execution speed.
* **Causal Linkage**: All events include a `causedByEventId` pointer, constructing a complete causal chain for every decision.

### B. Interactive Mission Control Dashboard
We have replaced static views with a dynamic, real-time control console:
* **CognitiveCore SVG Visualizer**: An SVG graphic at the center of the dashboard that pulses and animates based on active engine FSM states.
* **Timeline Scrubber**: Allows users to pause active sessions, scrub backwards and forwards tick-by-tick, and step through history.
* **Virtualized Event List**: Powered by `@tanstack/react-virtual`, providing lag-free scrolling through tens of thousands of historical simulation events.
* **Diagnostics Panel**: Displays real-time charts (via Recharts) tracking event rate densities, cognition heat maps, average API response latency, and error pressure.

### C. Adaptive Prompt & Cognition Pipeline
Manages agent execution and handles errors when communicating with model APIs:
* **ContextCompiler**: Assembles turn-level context matrices (persona blocks, legal actions, error history) prior to rendering prompts.
* **Correction & Escalation**: If an agent submits an illegal action, the pipeline triggers deterministic prompt corrections (Level 1–4) or fallback overrides.
* **Model Capability Registry**: Classifies model performance tiers (TINY to REASONING) and dynamically adjusts prompt complexity.
* **Provider Abstraction**: Features built-in API routing, automatic retry protocols, timeout escalation, and system role format fallbacks.

### D. Portable Session Replays
Replay sessions are now assets that can be exported, shared, and replayed:
* **Zustand Replay Store**: Reconstructs state cleanly from imported JSON trace arrays using pure reconstruction functions.
* **Replay Library Panel**: A dashboard directory to search, sort, and tag saved simulations, with automatic background saving driven by IndexedDB.

### E. Production Packaging & Onboarding
Neural Arena is now packaged as double-clickable desktop software:
* **Electron Production Packaging**: Pre-configured build systems using `electron-builder` to compile Windows installer (`.exe`) and portable executables.
* **Onboarding Wizard**: A first-run wizard prompting the user to configure API connections and review privacy consent variables.
* **Crash Recovery Backup**: An automated backup system that caches session logs locally to prevent data loss on network drops.

---

## 2. Packaging & Compilation Configuration

The production build pipeline compiles TypeScript code, builds Vite assets, and packages the desktop app via `electron-builder`.

### Scripts definition in `package.json`
* **`npm run build:release`**: Compiles the backend TypeScript engine into standard ES Modules in `dist/`.
* **`npm run dashboard:build`**: Bundles the React dashboard code into `dist-dashboard/`.
* **`npm run electron:package`**: Triggers the packaging process.

### Windows Packaging configuration
```json
"build": {
  "appId": "com.neuralarena.app",
  "productName": "Neural Arena",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "dist-dashboard/**/*",
    "electron-main.js"
  ],
  "win": {
    "target": ["nsis", "portable"],
    "icon": "assets/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true
  }
}
```

---

## 3. Comprehensive Troubleshooting Guide

### A. Socket.IO Connection Failure (`Cannot Connect to Port 4000`)
* **Symptom**: Dashboard shows a red disconnect indicator; simulation controls are locked.
* **Cause**: The headless engine is not running, or another process is occupying Port `4000`.
* **Remedies**:
  1. Verify the process is active by running `netstat -ano | findstr 4000` (Windows) or `lsof -i :4000` (macOS/Linux).
  2. Kill conflicting processes:
     ```powershell
     Stop-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess -Force
     ```
  3. Ensure server logs in the command terminal show: `Server running on port 4000`.

### B. Blank White Screen in Electron Window
* **Symptom**: The desktop window loads, but remains blank.
* **Cause**: Vite dev server is offline, or file path mappings in production packaging are misaligned.
* **Remedies**:
  1. If in development, make sure `npm run dev` has successfully spun up `http://localhost:5173`.
  2. Check path resolution inside `electron-main.js`. Verify it correctly references absolute paths using `file://` protocols:
     ```javascript
     mainWindow.loadURL(isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, 'dist-dashboard/index.html')}`);
     ```

### C. LocalStorage Quota Receeded
* **Symptom**: Settings or provider profiles cannot be saved. Console displays `QuotaExceededError`.
* **Cause**: Too many historical event logs saved to LocalStorage.
* **Remedies**:
  1. The v1.0.0 release migrates event stores to IndexedDB. If legacy files remain, run:
     ```javascript
     localStorage.clear();
     ```
  2. Use the Replay Library panel to export and delete old sessions to free space.

---

## 4. Bug Fixes Index (alpha.1)

* **Fix #104**: Resolved a race condition where the FSM scheduler would request a turn update before the client finished loading the previous world state hash.
* **Fix #112**: Fixed a crash in the normalizer when interacting with models that do not support standard API system roles. System prompts are now appended as standard user text inputs.
* **Fix #129**: Restructured the Replay scrubber timeline calculations to prevent state variables from drifting during rapid scrubbing actions.
* **Fix #134**: Corrected token calculations in `ContextCompiler.ts` to prevent context length errors when executing simulations with models having small context window limits.
