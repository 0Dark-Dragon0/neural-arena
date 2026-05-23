# Neural Arena Engineering Roadmap

Neural Arena has evolved from an experimental simulator into a production-grade **Autonomous Cognition Observatory**. This document outlines our four roadmap phases to transition the platform from a local desktop application into a distributed, multi-domain research platform.

---

```mermaid
timeline
    title Neural Arena Evolution
    section Phase 1 : Completed
        Deterministic Core : TickLoop, EventStore, WorldStateTree
        Mission Control UI : SVG Visualizer, Replay scrubber, Telemetry charts
        Desktop Architecture : Electron packaging, Window state persistence
    section Phase 2 : In Progress
        Domain Expansion : Debate, Negotiation, Cyber-defense environments
        Tool Use Interface : Schema-validated JSON, native model tools
        Remote Agent SDKs : Python and Rust bridges via WebSockets
    section Phase 3 : Scale
        Distributed Run Loop : Redis EventStore, multi-node orchestration
        Observed RAG Metrics : Context retrieval recall, vector database hooks
        Local Cloud Sync : Consent-based anonymized telemetry pipeline
    section Phase 4 : Trust
        Benchmarking Registry : Global public leaderboard, dataset exports
        Zero-Knowledge Traces : Verified decision paths without prompt leakage
    section Phase 5 : Feedback
        Agent Alignment RLHF : Collaborative annotation of replay histories
```

---

## Phase 1 — Deterministic Core & Visualization (Completed)

*Focus: Build a local-first, event-sourced runtime with a real-time visualization dashboard.*

### Key Accomplishments
* **Event-Sourced Loop**: Replaced mutable state objects with a chronological event stream, ensuring perfect session determinism.
* **Mission Control UI**: Created a React dashboard featuring real-time diagnostic telemetry, virtualized event lists, and a reactive cognitive SVG reactor.
* **Electron Packaging**: Configured compilation settings for Windows installers (`nsis`) and portable binaries.
* **Privacy-First Design**: Implemented local-only data aggregation and a telemetry review interface.

---

## Phase 2 — Multi-Domain Expansion & Remote SDKs (In Progress)

*Focus: Decouple domain logic and enable external processes to connect to the runtime.*

```
┌────────────────────────────────────────────────────────┐
│                   Neural Arena Server                  │
│                     (Port 4000)                        │
└───────────────────────────┬────────────────────────────┘
                            │ (WebSockets Transport)
                            ▼
 ┌──────────────────────────┴───────────────────────────┐
  │                  WebSocket Agent Gateway             │
  └──────┬───────────────────────┬───────────────────────┘
         ▼                       ▼                       ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Python Agent   │    │    Rust Agent    │    │    C++ Agent     │
│   (Local SDK)    │    │   (Remote SDK)   │    │   (Embedded)     │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

### 1. WebSocket Agent Gateway Protocol Specification
To support remote agent connections, we are designing a dedicated WebSocket gateway. This allows agents written in Python (e.g. running PyTorch or transformers locally) to connect directly to the execution pipeline.

#### Connection Lifecycle

##### A. Handshake (`agent_ready`)
When an external agent launches, it establishes a WebSocket connection and registers its metadata:
```json
{
  "event": "agent_ready",
  "data": {
    "agentId": "agent-py-llama-8b",
    "name": "Local LLaMA 3.1 8B",
    "domain": "chess",
    "capabilities": ["text", "json_mode"]
  }
}
```

##### B. Turn Notification (`turn_requested`)
The simulation engine dispatches a turn notice to the active agent connection socket:
```json
{
  "event": "turn_requested",
  "data": {
    "simulationId": "sim-881c-90bb",
    "tick": 742,
    "worldState": "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
    "legalMoves": ["d2d4", "c2c3", "f1b5", "f3e5"],
    "tacticalMemory": [
      {
        "tick": 740,
        "action": "f3g5",
        "reason": "illegal move"
      }
    ]
  }
}
```

##### C. Action Submission (`submit_action`)
The agent process responds with its decided action:
```json
{
  "event": "submit_action",
  "data": {
    "simulationId": "sim-881c-90bb",
    "tick": 742,
    "action": "f1b5"
  }
}
```

---

## Phase 3 — Distributed Run Loop & Deep RAG Audits (Upcoming)

*Focus: Scale the simulation runtime to cluster nodes and observe retrieval workflows.*

### 1. Redis-Backed Distributed EventStore
To run thousands of parallel simulations simultaneously, we will move the EventStore from local RAM to a **Redis Event Queue** cluster:
* **Stream Orchestration**: Every simulation session is mapped to a Redis Stream key (`na:sim:{id}`).
* **Node Scaling**: Worker nodes subscribe to these streams, process tick calculations, and push outputs back to Redis, allowing a single dashboard cluster to monitor multiple remote run loops.

### 2. Retrieval Benchmarking
Integrating hooks into vector databases (Chroma, Qdrant, Pinecone) to track the RAG pipeline during simulation steps:
* Recording `RETRIEVAL_EVENT` logs to analyze search relevance and context window usage.
* Evaluating how models adapt to irrelevant search results or prompt injections.

---

## Phase 4 — Cryptographic Verification & Portal Ecosystem (Long-Term)

*Focus: Build a public ecosystem for collaborative verification and agent evaluation.*

### 1. Zero-Knowledge Cognition Verification (ZK-Traces)
To verify agent decisions without leaking proprietary prompts, weights, or system configurations, we will deploy a cryptographic verification protocol using zk-SNARKs:
```
┌────────────────────────────────────────────────────────┐
│                      Agent Process                     │
│  Inputs: (System Prompt, State, Key) ──► Model Run    │
│  Output: Decided Action                                │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                   zk-SNARK Prover                      │
│   (Generates ZK-Proof of correct model generation)     │
└───────────────────────────┬────────────────────────────┘
                            │ (Proof data only)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Neural Arena Engine                  │
│       (Verifies proof without exposing prompts)        │
└────────────────────────────────────────────────────────┘
```
* **ZK-Proof Generation**: The agent process runs the LLM model inside a verifiable computation environment. It generates a proof showing that:
  1. The API request was signed by a verified provider key.
  2. The output action was chosen from the active `legalMoves` list returned by the engine.
  3. The decision path was computed without modifying the game rules.
* **Public Verification**: Researchers can verify the proof on a public ledger, confirming compliance without exposing sensitive prompts.
