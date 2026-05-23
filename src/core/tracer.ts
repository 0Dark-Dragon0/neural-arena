// ================================================================
// Neural Arena — Trace & Observability System
// ================================================================
// Listens to events and generates transparent Markdown traces of
// the entire orchestration timeline.
// ================================================================

import * as fs from 'fs';
import * as path from 'path';
import { EventBus, SimulationEvent, EventPayload, SimulationEventPayload } from '../engine/EventBus';
import { MatchResult } from './types';

interface TurnTrace {
  turnNumber: number;
  agentName: string;
  fen?: string;
  providerStatus?: string;
  cooldownMs?: number;
  attempts: TurnAttemptTrace[];
  finalAction?: string;
  durationMs?: number;
}

interface TurnAttemptTrace {
  attemptNumber: number;
  prompt?: string;
  rawContent?: string;
  apiDurationMs?: number;
  normalizationStrategy?: string;
  providerCompatibility: string[];
  cognitiveDecisions: string[];
  adaptedMessages?: any[];
  anticheatFails: { gate: string; reason: string }[];
  moveInvalidReason?: string;
}

export class MatchTracer {
  private baseDir: string;
  private matchId: string;
  private turns: Map<number, TurnTrace> = new Map();
  private currentTurn = 0;
  private currentAttempts: Record<number, number> = {}; // agentIndex -> attempt count
  
  // Track configuration info for the header
  private agents: any[] = [];
  private startTime: number = Date.now();
  
  constructor(projectDir: string, events: EventBus, agents: any[]) {
    this.baseDir = path.join(projectDir, 'traces');
    this.matchId = `match_${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}`;
    this.agents = agents;
    
    // Ensure directories exist
    ['matches', 'providers', 'errors'].forEach(dir => {
      const p = path.join(this.baseDir, dir);
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    });

    this.subscribe(events);
  }

  private subscribe(events: EventBus): void {
    events.subscribeAll((payload: SimulationEventPayload | EventPayload) => {
      this.processEvent(payload);
    });
  }

  private getTurnAttempt(agentIndex: number): TurnAttemptTrace {
    const turn = this.turns.get(this.currentTurn);
    if (!turn) return { attemptNumber: 0, providerCompatibility: [], cognitiveDecisions: [], anticheatFails: [] };
    
    const attemptNum = this.currentAttempts[agentIndex] || 0;
    if (!turn.attempts[attemptNum]) {
      turn.attempts[attemptNum] = { attemptNumber: attemptNum, providerCompatibility: [], cognitiveDecisions: [], anticheatFails: [] };
    }
    return turn.attempts[attemptNum];
  }

  private processEvent(payload: SimulationEventPayload | EventPayload): void {
    const { type, data } = payload;

    if (type === SimulationEvent.WORLD_STATE_UPDATED) {
      // New world state means next turn starts
      this.currentTurn = Number(data.metadata?.turnNumber ?? data.turnNumber ?? Math.floor((data.state?.history?.length || 0) / 2) + 1);
      if (!this.turns.has(this.currentTurn)) {
        this.turns.set(this.currentTurn, {
          turnNumber: this.currentTurn,
          agentName: '',
          fen: typeof data.state === 'string' ? data.state : data.state?.fen as string,
          attempts: [],
        });
      }
    } 
    else if (type === SimulationEvent.WORLD_WAITING_FOR_INTENT) {
      this.currentTurn = Number(data.turnNumber ?? this.currentTurn);
      const turn = this.turns.get(this.currentTurn);
      if (turn && data.agentIndex !== undefined) {
        turn.agentName = this.agents[data.agentIndex]?.name || `Agent ${data.agentIndex}`;
        if (this.currentAttempts[data.agentIndex] === undefined) {
          this.currentAttempts[data.agentIndex] = 0;
        }
      }
    }
    else if (type === SimulationEvent.API_REQUEST_START) {
      const attempt = this.getTurnAttempt(data.agentIndex as number);
      attempt.prompt = data.prompt as string;
    }
    else if (
      type === SimulationEvent.PROMPT_STRATEGY_SELECTED ||
      type === SimulationEvent.COGNITIVE_CORRECTION_APPLIED ||
      type === SimulationEvent.PROMPT_ESCALATION_LEVEL_CHANGED ||
      type === SimulationEvent.ILLEGAL_MOVE_PATTERN_DETECTED ||
      type === SimulationEvent.CONTEXT_COMPILED ||
      type === SimulationEvent.MEMORY_BLOCK_INJECTED ||
      type === SimulationEvent.PERSONA_BLOCK_INJECTED ||
      type === SimulationEvent.CONSTRAINT_BLOCK_INJECTED ||
      type === SimulationEvent.COGNITIVE_GRAPH_TRANSITION ||
      type === SimulationEvent.FSM_NODE_EXECUTED
    ) {
      const attempt = this.getTurnAttempt(data.agentIndex as number);
      attempt.cognitiveDecisions.push(
        `[${type}] ${String(data.strategyId || data.nodeId || data.from || data.kind || data.rejectedMove || data.mode || 'cognition')} ${String(data.reason || data.message || '')}`.trim()
      );
    }
    else if (type === SimulationEvent.API_RESPONSE_RECEIVED) {
      const attempt = this.getTurnAttempt(data.agentIndex as number);
      attempt.rawContent = data.rawContent as string;
    }
    else if (
      type === SimulationEvent.PROVIDER_CAPABILITY_LOOKUP ||
      type === SimulationEvent.PROVIDER_ADAPTATION ||
      type === SimulationEvent.PROVIDER_PROMPT_TRANSFORMED ||
      type === SimulationEvent.PROVIDER_FALLBACK_ACTIVATED ||
      type === SimulationEvent.PROVIDER_UNSUPPORTED_FEATURE_HANDLED ||
      type === SimulationEvent.PROVIDER_COMPATIBILITY_DECISION
    ) {
      const attempt = this.getTurnAttempt(data.agentIndex as number);
      attempt.providerCompatibility.push(
        `[${String(data.code || type)}] ${String(data.message || type)}`
      );

      if (Array.isArray(data.messages)) {
        attempt.adaptedMessages = data.messages;
      }
    }
    else if (type === SimulationEvent.ANTICHEAT_PASS) {
      const attempt = this.getTurnAttempt(data.agentIndex as number);
      attempt.normalizationStrategy = data.normalizationStrategy as string;
    }
    else if (type === SimulationEvent.NORMALIZATION_RECOVERY) {
      const attempt = this.getTurnAttempt(data.agentIndex as number);
      attempt.normalizationStrategy = data.strategy as string;
    }
    else if (type === SimulationEvent.ANTICHEAT_FAIL) {
      const attempt = this.getTurnAttempt(data.agentIndex as number);
      attempt.anticheatFails.push({
        gate: String(data.gate || 'UNKNOWN'),
        reason: String(data.reason || 'Unknown anti-cheat failure'),
      });
    }
    else if (type === SimulationEvent.INTENT_REJECTED) {
      const attempt = this.getTurnAttempt(data.agentIndex as number);
      attempt.moveInvalidReason = data.reason as string;
      this.currentAttempts[data.agentIndex as number]++;
    }
    else if (type === SimulationEvent.INTENT_STALE_REJECTED) {
      const attempt = this.getTurnAttempt(data.agentIndex as number);
      attempt.moveInvalidReason = `Stale intent rejected: ${data.reason}`;
      this.currentAttempts[data.agentIndex as number]++;
    }
    else if (type === SimulationEvent.INTENT_ACCEPTED) {
      const turn = this.turns.get(this.currentTurn);
      if (turn) {
        turn.finalAction = data.action as string;
      }
      this.currentAttempts[data.agentIndex as number] = 0; // reset for next turn
    }
    else if (type === SimulationEvent.MATCH_OVER) {
      this.saveMatchTrace(data.result as any);
    }
  }

  /** Render and save the full match trace */
  public saveMatchTrace(result: any): string {
    const md: string[] = [];
    const durationMs = Date.now() - this.startTime;
    
    md.push(`# Neural Arena Trace: ${this.matchId}`);
    md.push(`* **Timestamp**: ${new Date().toISOString()}`);
    md.push(`* **Result**: ${result.reason || 'Unknown'}`);
    md.push(`* **Winner**: ${result.winner !== undefined ? this.agents[result.winner]?.name : 'Draw'}`);
    md.push(`* **Duration**: ${(durationMs / 1000).toFixed(1)}s`);
    
    md.push(`\n## Agents`);
    this.agents.forEach((agent, i) => {
      md.push(`* **${agent.name}** (${agent.model})`);
    });

    md.push(`\n## Orchestration Timeline`);

    for (const [turnNum, turn] of this.turns) {
      md.push(`\n---\n`);
      md.push(`### Turn ${turnNum} - ${turn.agentName}`);
      if (turn.fen) md.push(`**Board State (FEN):** \`${turn.fen}\``);

      for (const attempt of turn.attempts) {
        if (!attempt) continue;
        md.push(`\n#### Attempt ${attempt.attemptNumber}`);
        
        md.push(`\n<details><summary><b>View Exact Prompt Sent</b></summary>\n`);
        md.push("```text\n" + (attempt.prompt || '(No prompt)') + "\n```\n");
        md.push(`</details>\n`);

        md.push(`\n<details><summary><b>View Raw AI Response</b></summary>\n`);
        md.push("```text\n" + (attempt.rawContent || '(Empty content)') + "\n```\n");
        md.push(`</details>\n`);

        if (attempt.normalizationStrategy) {
          md.push(`> 🛠 **Normalization Recovery**: Strategy \`${attempt.normalizationStrategy}\` successfully extracted structured data.`);
        }

        if (attempt.providerCompatibility.length > 0) {
          md.push(`\n<details><summary><b>Provider Compatibility Decisions</b></summary>\n`);
          for (const note of attempt.providerCompatibility) {
            md.push(`* ${note}`);
          }

          if (attempt.adaptedMessages) {
            md.push(`\n\`\`\`json\n${JSON.stringify(attempt.adaptedMessages, null, 2)}\n\`\`\`\n`);
          }

          md.push(`</details>\n`);
        }

        if (attempt.cognitiveDecisions.length > 0) {
          md.push(`\n<details><summary><b>Cognitive Adaptation Decisions</b></summary>\n`);
          for (const note of attempt.cognitiveDecisions) {
            md.push(`* ${note}`);
          }
          md.push(`</details>\n`);
        }

        if (attempt.anticheatFails && attempt.anticheatFails.length > 0) {
          for (const ac of attempt.anticheatFails) {
            md.push(`> ❌ **Anti-Cheat Rejected** [${ac.gate}]: ${ac.reason}`);
          }
        }

        if (attempt.moveInvalidReason) {
          md.push(`> ❌ **Illegal Move/Error**: ${attempt.moveInvalidReason}`);
        }
      }

      if (turn.finalAction) {
        md.push(`\n✅ **Turn Complete**: Played \`${turn.finalAction}\``);
      } else {
        md.push(`\n💥 **Turn Failed/Forfeited**`);
      }
    }

    const filePath = path.join(this.baseDir, 'matches', `${this.matchId}.md`);
    fs.writeFileSync(filePath, md.join('\n'));
    return filePath;
  }
}
