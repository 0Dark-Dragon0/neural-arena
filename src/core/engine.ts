// ================================================================
// Neural Arena — Simulation Engine
// ================================================================
// Top-level engine that wires everything together.
// This is the single entry point for running a match.
//
// STABILIZATION: Added provider cooldown, analytics integration,
// and increased defaults for slow providers.
// ================================================================

import {
  BattlefieldPlugin,
  SimulationConfig,
  AgentConfig,
  MatchResult,
  SimulationState,
  LogLevel,
} from './types';
import { AgentManager } from './agent-manager';
import { ApiClient } from './api-client';
import { AntiCheatPipeline } from './anticheat';
import { TurnOrchestrator } from './turn-orchestrator';
import { EventSystem } from './event-system';
import { Recorder } from './recorder';
import { Logger } from './logger';
import { MatchTracer } from './tracer';

/** Default simulation configuration */
export const DEFAULT_CONFIG: SimulationConfig = {
  maxRetries: 3,            // retries per turn for invalid moves
  timeoutMs: 120000,        // 120 second API timeout (NVIDIA can take 30-60s+)
  maxResponseBytes: 1048576, // 1MB max response size (supports reasoning models)
  maxTokens: 150,           // max tokens requested from AI
  cooldownMs: 3000,         // 3 second cooldown between API calls
  tickRateMs: 100,          // 100ms per deterministic tick
};

export class Engine {
  private plugin: BattlefieldPlugin;
  private config: SimulationConfig;
  private agentManager: AgentManager;
  private apiClient: ApiClient;
  private anticheat: AntiCheatPipeline;
  private events: EventSystem;
  private logger: Logger;

  constructor(
    plugin: BattlefieldPlugin,
    config: Partial<SimulationConfig> = {},
    logLevel: LogLevel = LogLevel.INFO,
    projectDir: string = process.cwd(),
  ) {
    this.plugin = plugin;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new Logger(logLevel, `${projectDir}/logs`);
    this.events = new EventSystem();
    this.agentManager = new AgentManager();
    this.apiClient = new ApiClient(this.config, this.logger);
    this.anticheat = new AntiCheatPipeline(plugin, this.config, this.logger);
    // this.recorder = new Recorder(projectDir);
    // this.tracer = new MatchTracer(projectDir, this.events);

    this.logger.info('Engine initialized', {
      timeout: `${this.config.timeoutMs / 1000}s`,
      cooldown: `${this.config.cooldownMs / 1000}s`,
      maxRetries: this.config.maxRetries,
      maxTokens: this.config.maxTokens,
    });
  }

  /** Get the event system to subscribe to match events */
  getEvents(): EventSystem {
    return this.events;
  }

  /** Register an agent (player) */
  addAgent(config: Omit<AgentConfig, 'index'>): AgentConfig {
    return this.agentManager.addAgent(config);
  }

  /**
   * Run a complete match.
   * Both agents must be registered before calling this.
   */
  async runMatch(): Promise<MatchResult> {
    // Validate agents
    const expectedAgents = this.plugin.metadata.maxAgents;
    if (this.agentManager.getAgentCount() < expectedAgents) {
      throw new Error(
        `Need ${expectedAgents} agents, only ${this.agentManager.getAgentCount()} registered`
      );
    }

    this.logger.info('Starting match', {
      plugin: this.plugin.metadata.name,
      agent0: this.agentManager.getAgentDisplayName(0),
      agent1: this.agentManager.getAgentDisplayName(1),
    });

    // Create orchestrator and run
    const orchestrator = new TurnOrchestrator(
      this.plugin,
      this.config,
      this.agentManager,
      this.apiClient,
      this.anticheat,
      this.events,
      this.logger,
    );

    try {
      const result = await orchestrator.run();

      // Build agent display info (no API keys)
      const agents = this.agentManager.getAllAgents().map(a => ({
        name: a.name,
        model: a.model,
      }));

      // Build analytics report
      const analytics = result.analytics.buildReport(result.durationMs);

      // Extract provider health snapshots
      const providerHealth: Record<number, any> = {};
      const snapshots = result.providerManager.getAllSnapshots();
      for (const [idx, snap] of snapshots) {
        providerHealth[idx] = snap;
      }

      // Build the final result object
      const finalResult: MatchResult = {
        state: result.state,
        result: result.result,
        turns: result.turns,
        durationMs: result.durationMs,
        pluginRecord: this.plugin.formatRecord(
          result.turns,
          agents.map(a => a.name),
        ),
        agents,
        timestamp: Date.now(),
        analytics,
        providerHealth,
      };

      // Record the match (JSON/PGN)
      // const paths = this.recorder.saveMatch(
      //   this.plugin,
      //   finalResult.state,
      //   finalResult.result,
      //   finalResult.turns,
      //   agents,
      //   finalResult.durationMs,
      //   analytics,
      // );

      // Save the trace
      // const tracePath = this.tracer.saveMatchTrace(finalResult);

      // this.logger.info('Match recorded', {
      //   jsonPath: paths.jsonPath,
      //   pluginPath: paths.pluginPath,
      //   tracePath,
      // });

      return finalResult;
    } catch (error: any) {
      this.logger.error('Match failed with unrecoverable error', {
        error: error.message,
      });

      const errorResult: MatchResult = {
        state: SimulationState.ERROR,
        result: {
          winner: null,
          reason: `Engine error: ${error.message}`,
          isDraw: false,
        },
        turns: [],
        durationMs: 0,
        pluginRecord: '',
        agents: this.agentManager.getAllAgents().map(a => ({
          name: a.name,
          model: a.model,
        })),
        timestamp: Date.now(),
        analytics: { totalTurns: 0, totalDurationMs: 0, agents: [], turnData: [] },
      };

      // this.tracer.saveMatchTrace(errorResult);
      return errorResult;
    }
  }
}
