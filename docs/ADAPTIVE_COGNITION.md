# Adaptive Cognition Architecture

Neural Arena separates simulation authority from model-facing cognition:
* The **World** owns reality, validates intents, and emits immutable events.
* The **Cognition Layer** shapes prompts and handles correction memory before an agent submits an intent.

---

## 1. Context Compiler Matrix (`ContextCompiler.ts`)

Prior to dispatching requests, the `ContextCompiler` structures inputs into independent blocks. This ensures that text is only the final transport format, while context remains structured internally:

```typescript
export interface PersonaBlock {
  name: string;
  role: string;
  aggressionLevel: number; // 0.0 - 1.0
  riskTolerance: number;   // 0.0 - 1.0
  description: string;
}

export interface TacticalMemoryBlock {
  rejectedActions: Array<{
    tick: number;
    action: string;
    reason: string;
    correctionLevel: number;
  }>;
  recentSuccessfulActions: string[];
}

export interface LegalMovesBlock {
  format: 'algebraic' | 'json' | 'indexed';
  moves: string[];
}

export interface ConstraintBlock {
  outputFormat: 'json';
  schema: string;
  antiCheatRules: string[];
  maxThinkingSeconds: number;
}
```

---

## 2. Prompt Escalation Flow

Escalation is deterministic, local-first, and scoped to the active turn. If a model generates an illegal action or invalid JSON, Neural Arena applies progressive prompt corrections on the next retry.

```
Level 0: Standard Prompt (Structured parameters)
   │
   ▼ (Invalid move or malformed JSON)
Level 1: Correction Insert ("Your action was rejected because...")
   │
   ▼ (Repeated failure)
Level 2: Strict Constraint ("You must select from the following legal move list...")
   │
   ▼ (Critical failure)
Level 3: Minimal Deterministic (Minimal text, index-mapped legal actions)
   │
   ▼ (Extreme failure)
Level 4: Forced Constrained Fallback (Bypasses LLM, engine executes random legal action)
```

### Level Prompt Details

#### Level 0: Standard Prompt
Sends persona descriptions, FEN structures, and basic JSON output schemas.
* *Example prompt prompt*:
  ```json
  "system": "You are white. Act according to your persona: Aggressive. Return a JSON block containing {"move": "algebraic_notation"}."
  ```

#### Level 1: Basic Correction
Appends tactical memory containing the rejected move and the rejection reason.
* *Example prompt prompt*:
  ```json
  "system": "... Previous Attempt: 'e5e6' was rejected: 'Square e5 is empty'. Correct your decision."
  ```

#### Level 2: Strict Legal Enforcement
Appends a list of legal actions directly into the prompt instructions, demanding selection from the list.
* *Example prompt prompt*:
  ```json
  "system": "... You MUST choose from this list: ['e2e4', 'd2d4', 'g1f3']. Any other input is invalid."
  ```

#### Level 3: Index-Mapped Minimal Text
Strips formatting, system instructions, and schemas. Translates legal moves into numbered lists (e.g. `1, 2, 3`) and requests a single integer response.
* *Example prompt prompt*:
  ```json
  "user": "Select one number:\n1: e2e4\n2: d2d4\n3: g1f3\nResponse format: exact number."
  ```

#### Level 4: Engine Overrule
If Level 3 fails, the engine bypasses model inference entirely. It selects a random legal move from the list, issues an `ENGINE_OVERRULED` event, and continues the simulation to prevent thread blocks.

---

## 3. Model Capability Registry (`ModelCapabilityRegistry.ts`)

Not all models possess the cognitive capacity to parse complex JSON structures or plan long-term. The `ModelCapabilityRegistry` classifies model configurations to adjust prompt rendering styles.

### Classification Tiers
* `TINY`: Models with $< 3\text{B}$ parameters. Handled using strict Level 2 formats from start.
* `SMALL`: Models from $3\text{B} - 9\text{B}$ parameters. Structured JSON is requested, but index fallback is engaged immediately on the first error.
* `MEDIUM`: Models from $10\text{B} - 30\text{B}$ parameters. Balanced prompt sizes.
* `LARGE`: Models with $> 30\text{B}$ parameters. Full structured prompt layouts.
* `REASONING`: Models utilizing internal chain-of-thought processing. Latency timeout values are scaled up.

### Capability Flags Tracking

| Capability Flag | TINY | SMALL | MEDIUM | LARGE | REASONING |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **System Role Support** | No | Yes | Yes | Yes | Yes |
| **JSON Mode Support** | No | Partial | Yes | Yes | Yes |
| **Legal Move Compliance**| Low | Medium | High | High | Very High |
| **Repetition Risk** | High | Medium | Low | Low | Very Low |
| **Timeout Limits** | 5s | 10s | 15s | 20s | 60s |

---

## 4. Correction Memory Cycle

* **Initialization**: At the start of a turn, `TacticalMemory` is loaded. It retains errors accumulated during the *active turn*.
* **Commit**: On a successful `INTENT_ACCEPTED` event, `TacticalMemory` is cleared. State history is committed, and control transfers to the next agent.
* **Orchestration Boundaries**: Timeline scrubbing or session pauses do not update tactical memory. These are orchestration actions, not model execution errors.
