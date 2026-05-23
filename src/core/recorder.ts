// ================================================================
// Neural Arena — Match Recorder
// ================================================================
// Records complete match data as JSON + plugin-specific format.
// Saves to the matches/ directory automatically.
// ================================================================

import * as fs from 'fs';
import * as path from 'path';
import { EventBus, SimulationEvent, EventPayload, SimulationEventPayload } from '../engine/EventBus';
import { MatchResult, TurnRecord, BattlefieldPlugin, GameResult, SimulationState, MatchAnalytics } from './types';

export class Recorder {
  private matchDir: string;
  private plugin: BattlefieldPlugin;
  private agents: { name: string; model: string }[];
  private startTime: number;
  private turns: TurnRecord[] = [];
  
  // Track current turn data
  private currentTurnNumber = 1;
  private currentStateSnapshot: any = {};

  constructor(baseDir: string, events: EventBus, plugin: BattlefieldPlugin, agents: { name: string; model: string }[]) {
    this.matchDir = path.join(baseDir, 'matches');
    if (!fs.existsSync(this.matchDir)) {
      fs.mkdirSync(this.matchDir, { recursive: true });
    }
    
    this.plugin = plugin;
    this.agents = agents;
    this.startTime = Date.now();
    
    events.subscribeAll((payload) => this.processEvent(payload));
  }
  
  private processEvent(payload: SimulationEventPayload | EventPayload) {
    if (payload.type === SimulationEvent.WORLD_STATE_UPDATED) {
      this.currentStateSnapshot = payload.data.state || {};
      this.currentTurnNumber = Number(
        payload.data.metadata?.turnNumber ??
        payload.data.turnNumber ??
        Math.floor((this.currentStateSnapshot.history?.length || 0) / 2) + 1
      );
    } else if (payload.type === SimulationEvent.INTENT_ACCEPTED) {
      this.turns.push({
        turnNumber: this.currentTurnNumber,
        agentIndex: payload.data.agentIndex as number,
        action: payload.data.action as string,
        timestamp: Date.now(),
        durationMs: 0, // Hard to track exactly without coupling; keeping 0 for now
        retriesUsed: 0
      });
    } else if (payload.type === SimulationEvent.MATCH_OVER) {
      this.saveMatch(payload.data.result as GameResult);
    }
  }

  /**
   * Build and save a complete match record.
   * Saves both JSON (full data) and plugin format (e.g. PGN for chess).
   */
  private saveMatch(result: GameResult): { jsonPath: string; pluginPath: string } {
    const timestamp = Date.now();
    const durationMs = timestamp - this.startTime;
    const dateStr = new Date(timestamp).toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const baseName = `match_${dateStr}`;

    // Build match result object
    const matchResult: MatchResult = {
      state: result.winner !== undefined ? SimulationState.COMPLETE : SimulationState.FORFEIT, // Approximate state
      result,
      turns: this.turns,
      durationMs,
      pluginRecord: this.plugin.formatRecord(this.turns, this.agents.map(a => a.name)),
      agents: this.agents,
      timestamp,
      analytics: { totalTurns: this.turns.length, totalDurationMs: durationMs, agents: [], turnData: [] },
    };

    // Save JSON (complete match data)
    const jsonPath = path.join(this.matchDir, `${baseName}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(matchResult, null, 2));

    // Save plugin format (PGN for chess, etc.)
    const ext = this.plugin.metadata.name === 'chess' ? 'pgn' : 'txt';
    const pluginPath = path.join(this.matchDir, `${baseName}.${ext}`);
    fs.writeFileSync(pluginPath, matchResult.pluginRecord);

    return { jsonPath, pluginPath };
  }
}
