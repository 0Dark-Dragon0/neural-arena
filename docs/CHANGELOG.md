# Changelog

All notable changes to Neural Arena will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-alpha.1] - 2026-05-21

Neural Arena v1.0.0-alpha.1 marks the official transition from an experimental Chess simulator into a production-ready, local-first **Autonomous Cognition Observatory and Benchmarking Platform**.

### Added

#### A. Deterministic Runtime Core
* **Append-Only EventStore**: Created an append-only store saving all simulation events chronologically. Events are frozen (`Object.freeze`) to guarantee immutability.
* **Merkle WorldStateTree**: Implemented structural state hashing (SHA-256) at every tick transition, allowing parent state comparisons and rewind operations.
* **Deterministic SimulationClock**: Replaced physical millisecond scheduling with a discrete tick-based clock. Eliminates scheduling jitter caused by CPU or thread loads.
* **Causal Linkage**: Stamp all events with sequential monotonic integers and a `causedByEventId` pointer, constructing a complete causal chain for every decision.
* **Intent Gateway validation**: Implemented legality verification checks to examine submitted agent intents prior to committing updates.

#### B. Cognitive Prompt Pipeline
* **Context Matrix compiler**: Assembles persona blocks, board states, tactical error memories, constraints, and legal move lists prior to prompt rendering.
* **Turn State Machine**: Coordinates turn scheduling using a formal FSM (IDLE, THINKING, AWAITING_RESPONSE, VALIDATING, ACCEPTED, REJECTED).
* **Prompt Escalation (Level 0–4)**: Progressive warning and minimal index fallback prompt structures to handle model format rejections or schema failures.
* **Model Capability Registry**: Classifies model types (TINY to REASONING) and updates prompt modes and timeout parameters based on active failure profiles.
* **Provider Abstraction Layer**: Standardizes client setups, providing automatic exponential backoff, retry routing, and system role normalizations.

#### C. Mission Control Dashboard
* **CognitiveCore SVG Visualizer**: Added a react-reactive visual central widget that pulses and changes color according to active FSM states.
* **Timeline Scrubber**: Added dynamic scrubber tracks showing move markers. Supports dragging timeline handles to view history.
* **Diagnostics Panel**: Integrates Recharts graphing event frequencies, latencies, provider failures, and error counts.
* **Virtualized Event Stream**: Integrates `@tanstack/react-virtual` to display large event databases without browser memory leaks.
* **Move History Table**: A structured grid showing algebraic notation moves with auto-scrolling updates.

#### D. Replay System
* **Pure State Reconstruction**: Implemented state rebuilding loops using pure `replayToIndex` mappings, removing side effects during scrubbing.
* **IndexedDB Replay Library**: Created storage pipelines using local files and database caches to let users search, sort, and tag saved simulations.
* **Replay Import/Export**: Added utilities to load and export `.neural-arena.json` simulation trace logs directly.

#### E. Desktop Integration & Onboarding
* **Electron Window management**: Persists client bounds, positions, and preferences. Registers system tray integrations and handles graceful engine shutdowns.
* **Onboarding Wizard**: A 4-step first-run wizard guiding users through welcome, provider setups, privacy consents, and preset choices.
* **Crash Recovery Backup**: Saves active logs every 30 seconds to LocalStorage, offering backup restorations on disconnects.
* **Windows Packaging**: Pre-configured build systems using `electron-builder` to compile Windows installer (`.exe`) and portable executables.
