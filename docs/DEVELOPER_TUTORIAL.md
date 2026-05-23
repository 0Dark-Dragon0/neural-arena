# Developer Tutorial: Implementing a Custom Simulation Domain

Neural Arena is a **domain-agnostic** orchestration engine. While Chess is the first simulation domain, the core platform knows nothing about Chess rules. The `EventBus`, `EventStore`, `SimulationClock`, `ContextCompiler`, and `BenchmarkScorer` process generic inputs and states.

This tutorial provides a step-by-step guide to adding a brand-new simulation domain: **Debate Arena**.

---

## 1. Architectural Overview of Domains

To add a new simulation domain, you must implement the `SimulationDomain` interface on the server engine and register corresponding visualizers and benchmarking adapters in the dashboard frontend.

```
                  ┌──────────────────────────────┐
                  │   Neural Arena Core Engine   │
                  └──────────────┬───────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     ▼                           ▼                           ▼
┌──────────────┐            ┌──────────────┐            ┌──────────────┐
│  State FSM   │            │  Event Store │            │  Socket Hub  │
└──────┬───────┘            └──────┬───────┘            └──────┬───────┘
       │                           │                           │
       ▼                           ▼                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  SimulationDomain Interface Contract                 │
│  - getInitialState()                                                 │
│  - validateAction(state, action)                                     │
│  - applyAction(state, action)                                        │
│  - getLegalActions(state, agentIndex)                                │
│  - toContextRepresentation(state)                                    │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │    Custom Adapter Instance    │
                   │        (DebateDomain)         │
                   └───────────────────────────────┘
```

---

## 2. Step 1: Defining Domain Types

First, create the types and interfaces for the domain. Create `src/engine/domains/DebateDomainTypes.ts`:

```typescript
export interface DebateState {
  topic: string;
  round: number;
  maxRounds: number;
  transcript: Array<{
    agentIndex: number;
    statement: string;
    logicalScore: number;
  }>;
  activeSpeakerIndex: number;
  status: 'in-progress' | 'consensus-reached' | 'time-limit-exceeded';
}

export interface DebateAction {
  statement: string;
  referencedPoints: string[];
  tone: 'assertive' | 'cooperative' | 'inquisitive';
}
```

---

## 3. Step 2: Implementing the SimulationDomain Interface

Create `src/engine/domains/DebateDomain.ts`. This class handles state calculations, move checking, and transcript updates:

```typescript
import { DebateState, DebateAction } from './DebateDomainTypes';

export interface SimulationDomain<S, A> {
  domainId: string;
  getInitialState(config: Record<string, any>): S;
  validateAction(state: S, action: A, agentIndex: number): { isValid: boolean; reason?: string };
  applyAction(state: S, action: A, agentIndex: number): S;
  getLegalActions(state: S, agentIndex: number): string[];
  isGameOver(state: S): { isOver: boolean; result?: string };
  toContextRepresentation(state: S): string;
}

export class DebateDomain implements SimulationDomain<DebateState, DebateAction> {
  public domainId = 'debate';

  public getInitialState(config: Record<string, any>): DebateState {
    return {
      topic: config.topic || 'Should artificial intelligence replace human decisions?',
      round: 1,
      maxRounds: config.maxRounds || 6,
      transcript: [],
      activeSpeakerIndex: 0, // Agent 0 starts
      status: 'in-progress'
    };
  }

  public validateAction(
    state: DebateState, 
    action: DebateAction, 
    agentIndex: number
  ): { isValid: boolean; reason?: string } {
    // 1. Verify speaker turn
    if (agentIndex !== state.activeSpeakerIndex) {
      return { isValid: false, reason: "Not this agent's turn to speak." };
    }

    // 2. Validate statement structure
    if (!action.statement || action.statement.trim().length < 10) {
      return { isValid: false, reason: 'Statement is too short or empty.' };
    }

    if (action.statement.length > 1000) {
      return { isValid: false, reason: 'Statement exceeds maximum length of 1000 characters.' };
    }

    return { isValid: true };
  }

  public applyAction(state: DebateState, action: DebateAction, agentIndex: number): DebateState {
    const updatedTranscript = [
      ...state.transcript,
      {
        agentIndex,
        statement: action.statement,
        logicalScore: this.gradeStatementLogic(action.statement)
      }
    ];

    const nextSpeaker = agentIndex === 0 ? 1 : 0;
    const currentRound = nextSpeaker === 0 ? state.round + 1 : state.round;
    
    let status = state.status;
    if (currentRound > state.maxRounds) {
      status = 'time-limit-exceeded';
    }

    return {
      ...state,
      transcript: updatedTranscript,
      activeSpeakerIndex: nextSpeaker,
      round: currentRound,
      status
    };
  }

  public getLegalActions(state: DebateState, agentIndex: number): string[] {
    if (agentIndex !== state.activeSpeakerIndex) {
      return [];
    }
    // Debate moves are open-ended text. We provide guideline prompts as structural rules.
    return [
      'SUBMIT_ARGUMENT: State your premise clearly.',
      'REBUTTAL: Reference the opponent\'s previous statement.',
      'CONCEDE: Accept the opponent\'s point and end the debate.'
    ];
  }

  public isGameOver(state: DebateState): { isOver: boolean; result?: string } {
    if (state.status === 'time-limit-exceeded') {
      return { isOver: true, result: 'Draw: Maximum rounds exceeded.' };
    }
    if (state.status === 'consensus-reached') {
      return { isOver: true, result: 'Consensus reached between agents.' };
    }
    return { isOver: false };
  }

  public toContextRepresentation(state: DebateState): string {
    // Compile active debate state into text readable by LLMs
    let representation = `DEBATE TOPIC: ${state.topic}\n`;
    representation += `CURRENT ROUND: ${state.round}/${state.maxRounds}\n\n`;
    representation += `TRANSCRIPT HISTORY:\n`;
    
    if (state.transcript.length === 0) {
      representation += `[No arguments submitted yet. You are first. Introduce your premise.]\n`;
    } else {
      state.transcript.forEach((entry, idx) => {
        representation += `Speaker ${entry.agentIndex === 0 ? 'White' : 'Black'}: "${entry.statement}"\n\n`;
      });
    }

    return representation;
  }

  private gradeStatementLogic(statement: string): number {
    // Simple mock logic grading function
    const wordCount = statement.split(' ').length;
    const containsEvidence = /evidence|because|shows|study|proven/i.test(statement);
    return containsEvidence ? Math.min(10, Math.round(wordCount / 10) + 3) : Math.min(10, Math.round(wordCount / 15));
  }
}
```

---

## 4. Step 3: Server Registration

Register the new domain inside the engine domain coordinator class. Create `src/engine/DomainRegistry.ts`:

```typescript
import { ChessDomain } from './domains/ChessDomain';
import { DebateDomain } from './domains/DebateDomain';
import { SimulationDomain } from './domains/SimulationDomain';

export class DomainRegistry {
  private static domains = new Map<string, SimulationDomain<any, any>>();

  public static initialize() {
    this.register(new ChessDomain());
    this.register(new DebateDomain());
  }

  public static register(domain: SimulationDomain<any, any>) {
    this.domains.set(domain.domainId, domain);
  }

  public static get(domainId: string): SimulationDomain<any, any> | undefined {
    return this.domains.get(domainId);
  }
}
```

Ensure this registry is initialized inside `src/index.ts` during server startup:
```typescript
import { DomainRegistry } from './engine/DomainRegistry';
DomainRegistry.initialize();
```

---

## 5. Step 4: Frontend Visualization Component

Now, create the dashboard visualizer panel. Create `src/dashboard/src/panels/DebateVisualizer.tsx`:

```tsx
import React from 'react';
import useReplayStore from '../state/useReplayStore';
import useDashboardStore from '../state/useDashboardStore';

export const DebateVisualizer: React.FC = React.memo(() => {
  // Select active state from stores
  const isReplay = useDashboardStore(state => state.isReplayMode);
  const activeEvents = useReplayStore(state => state.events);
  const cursor = useReplayStore(state => state.cursor);
  
  // Reconstruct debate state based on events array
  const debateState = React.useMemo(() => {
    let topic = 'Initial Topic';
    let round = 1;
    const statements: Array<{ speaker: string; text: string; score: number }> = [];

    const limit = isReplay ? cursor : activeEvents.length - 1;
    for (let i = 0; i <= limit; i++) {
      const ev = activeEvents[i];
      if (ev.type === 'SIMULATION_STARTED') {
        topic = ev.data.topic || topic;
      } else if (ev.type === 'WORLD_STATE_UPDATED') {
        round = ev.data.round || round;
      } else if (ev.type === 'INTENT_ACCEPTED') {
        statements.push({
          speaker: ev.data.agentIndex === 0 ? 'Agent White' : 'Agent Black',
          text: ev.data.action.statement,
          score: ev.data.logicalScore || 5
        });
      }
    }

    return { topic, round, statements };
  }, [activeEvents, cursor, isReplay]);

  return (
    <div className="flex flex-col h-full bg-background-dark border border-telemetry-cyan p-4 rounded-lg font-telemetry animate-fade-in">
      <div className="mb-4 border-b border-telemetry-cyan/20 pb-2">
        <h2 className="text-telemetry-cyan text-sm uppercase tracking-wider">Debate Topic</h2>
        <p className="text-foreground text-md mt-1 font-bold">{debateState.topic}</p>
        <span className="text-muted-foreground text-xs">Round: {debateState.round}</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {debateState.statements.length === 0 ? (
          <div className="text-muted-foreground text-center py-12 text-sm italic">
            Waiting for agents to open debate...
          </div>
        ) : (
          debateState.statements.map((stmt, idx) => (
            <div 
              key={idx} 
              className={`p-3 rounded border ${
                stmt.speaker.includes('White') 
                  ? 'bg-telemetry-cyan/5 border-telemetry-cyan/20 align-left' 
                  : 'bg-accent-purple/5 border-accent-purple/20 align-right'
              }`}
            >
              <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                <span>{stmt.speaker}</span>
                <span className="text-telemetry-cyan">Score: {stmt.score}/10</span>
              </div>
              <p className="text-foreground text-sm font-sans">{stmt.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

DebateVisualizer.displayName = 'DebateVisualizer';
```

---

## 6. Step 5: Benchmark Scorer Adapter

Add debate-specific evaluation functions. Create `src/lib/benchmark/adapters/DebateAdapter.ts`:

```typescript
import { BenchmarkResult } from '../BenchmarkScorer';
import { RuntimeEvent } from '../../../dashboard/src/types';

export class DebateAdapter {
  public static process(baseResult: BenchmarkResult, events: RuntimeEvent[]): BenchmarkResult {
    let totalLogicalScore = 0;
    let statementCount = 0;

    for (const ev of events) {
      if (ev.type === 'INTENT_ACCEPTED' && ev.data && typeof ev.data.logicalScore === 'number') {
        totalLogicalScore += ev.data.logicalScore;
        statementCount++;
      }
    }

    return {
      ...baseResult,
      domainData: {
        averageLogicalStrength: statementCount > 0 ? totalLogicalScore / statementCount : 0.0,
        totalArgumentsDelivered: statementCount
      }
    };
  }
}
```

---

## 7. Step 6: Registration & Validation

1. Run standard checks:
   ```bash
   npx tsc --noEmit
   npm run dashboard:build
   ```
2. Build the project code. Start the platform and verify the new `debate` domain is visible in the Onboarding Wizard domain setup selectors and renders arguments correctly.
