// ================================================================
// Neural Arena — Turn Orchestrator
// ================================================================
// Runs the core simulation loop:
//   cooldown → prompt → API call → anti-cheat → validate → apply
//
// ADAPTIVE: Cooldowns now adjust dynamically based on provider
// health. 429s trigger exponential backoff. Auth/404 errors cause
// immediate forfeit (no point retrying bad config).
// ================================================================

import {
  BattlefieldPlugin,
  SimulationConfig,
  TurnRecord,
  EventType,
  GameResult,
  SimulationState,
} from './types';
import { AgentManager } from './agent-manager';
import { ApiClient } from './api-client';
import { AntiCheatPipeline } from './anticheat';
import { EventSystem } from './event-system';
import { Logger } from './logger';
import { AnalyticsTracker } from './analytics';
import { ProviderManager, FailureType } from './provider-tracker';

export interface OrchestratorResult {
  state: SimulationState;
  result: GameResult;
  turns: TurnRecord[];
  durationMs: number;
  analytics: AnalyticsTracker;
  providerManager: ProviderManager;
}

export class TurnOrchestrator {
  private plugin: BattlefieldPlugin;
  private config: SimulationConfig;
  private agents: AgentManager;
  private apiClient: ApiClient;
  private anticheat: AntiCheatPipeline;
  private events: EventSystem;
  private logger: Logger;
  private analytics: AnalyticsTracker;
  private providers: ProviderManager;

  constructor(
    plugin: BattlefieldPlugin,
    config: SimulationConfig,
    agents: AgentManager,
    apiClient: ApiClient,
    anticheat: AntiCheatPipeline,
    events: EventSystem,
    logger: Logger,
  ) {
    this.plugin = plugin;
    this.config = config;
    this.agents = agents;
    this.apiClient = apiClient;
    this.anticheat = anticheat;
    this.events = events;
    this.logger = logger;
    this.analytics = new AnalyticsTracker();
    this.providers = new ProviderManager(config.cooldownMs, logger);
  }

  async run(): Promise<OrchestratorResult> {
    const matchStart = Date.now();
    const turns: TurnRecord[] = [];
    let gameState = this.plugin.initialize();
    let turnNumber = 0;

    // Initialize analytics and provider trackers
    this.analytics.setAgentNames([
      this.agents.getAgentDisplayName(0),
      this.agents.getAgentDisplayName(1),
    ]);

    const agentCount = this.agents.getAgentCount();
    for (let i = 0; i < agentCount; i++) {
      const agent = this.agents.getAgent(i);
      this.providers.initAgent(i, agent.baseUrl);
    }

    this.events.emit(EventType.MATCH_START, {
      plugin: this.plugin.metadata.name,
      agents: [
        this.agents.getAgentDisplayName(0),
        this.agents.getAgentDisplayName(1),
      ],
    });

    // ─── Main Loop ─────────────────────────────────────────────
    while (!this.plugin.isTerminal(gameState)) {
      turnNumber++;
      const agentIndex = this.plugin.getCurrentAgent(gameState);
      const tracker = this.providers.getTracker(agentIndex);

      // Adaptive cooldown: use provider-adjusted cooldown instead of fixed
      if (turnNumber > 1) {
        const cooldown = tracker.getAdaptedCooldownMs();
        if (cooldown > 0) {
          this.events.emit(EventType.COOLDOWN, {
            cooldownMs: cooldown,
            turnNumber,
            providerStatus: tracker.getStatus(),
          });
          await this.sleep(cooldown);
        }
      }

      this.events.emit(EventType.TURN_START, {
        turnNumber,
        agentIndex,
        agentName: this.agents.getAgentDisplayName(agentIndex),
        providerStatus: tracker.getStatus(),
        fen: (gameState as any).fen ? (gameState as any).fen() : undefined,
      });

      const turnResult = await this.executeTurn(gameState, agentIndex, turnNumber);

      if (turnResult.forfeit) {
        this.analytics.recordTurn({
          turnNumber,
          agentIndex,
          latencyMs: turnResult.durationMs,
          retriesUsed: turnResult.retriesUsed,
          timedOut: true,
          success: false,
        });

        const winnerIndex = agentIndex === 0 ? 1 : 0;

        this.events.emit(EventType.AGENT_FORFEIT, {
          agentIndex,
          agentName: this.agents.getAgentDisplayName(agentIndex),
          reason: turnResult.failReason,
          retriesUsed: turnResult.retriesUsed,
          failureType: turnResult.failureType,
        });

        return {
          state: SimulationState.FORFEIT,
          result: {
            winner: winnerIndex,
            reason: `${this.agents.getAgentDisplayName(agentIndex)} forfeited: ${turnResult.failReason}`,
            isDraw: false,
          },
          turns,
          durationMs: Date.now() - matchStart,
          analytics: this.analytics,
          providerManager: this.providers,
        };
      }

      // Valid move
      this.analytics.recordTurn({
        turnNumber,
        agentIndex,
        latencyMs: turnResult.durationMs,
        retriesUsed: turnResult.retriesUsed,
        timedOut: false,
        success: true,
      });

      const turnRecord: TurnRecord = {
        turnNumber,
        agentIndex,
        action: turnResult.action!,
        timestamp: Date.now(),
        durationMs: turnResult.durationMs,
        retriesUsed: turnResult.retriesUsed,
      };
      turns.push(turnRecord);

      gameState = this.plugin.applyAction(gameState, turnResult.action!);

      this.events.emit(EventType.MOVE_VALID, {
        turnNumber,
        agentIndex,
        agentName: this.agents.getAgentDisplayName(agentIndex),
        action: turnResult.action,
        retriesUsed: turnResult.retriesUsed,
        latencyMs: turnResult.durationMs,
      });

      if (turnNumber >= 300) {
        this.logger.warn('Match reached 300 turn limit, forcing draw');
        return this.buildResult(SimulationState.COMPLETE,
          { winner: null, reason: 'Turn limit reached (300)', isDraw: true },
          turns, matchStart);
      }
    }

    // ─── Game Over ─────────────────────────────────────────────
    const result = this.plugin.getResult(gameState);

    this.events.emit(EventType.MATCH_COMPLETE, {
      result,
      totalTurns: turnNumber,
      durationMs: Date.now() - matchStart,
    });

    return this.buildResult(SimulationState.COMPLETE, result, turns, matchStart);
  }

  /**
   * Execute a single turn with intelligent retry logic.
   * Auth/404 errors cause immediate forfeit (no point retrying).
   * 429 errors use exponential backoff before retrying.
   */
  private async executeTurn(
    gameState: unknown,
    agentIndex: number,
    turnNumber: number,
  ): Promise<{
    action?: string;
    forfeit: boolean;
    failReason?: string;
    failureType?: FailureType;
    retriesUsed: number;
    durationMs: number;
  }> {
    const agent = this.agents.getAgent(agentIndex);
    const legalActions = this.plugin.getLegalActions(gameState);
    const prompt = this.plugin.formatPrompt(gameState, legalActions);
    const tracker = this.providers.getTracker(agentIndex);
    const turnStart = Date.now();

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (attempt > 0) {
        this.events.emit(EventType.RETRY, {
          turnNumber,
          agentIndex,
          attempt,
          maxRetries: this.config.maxRetries,
        });
        this.logger.info(`Retry ${attempt}/${this.config.maxRetries} for ${this.agents.getAgentDisplayName(agentIndex)}`);
      }

      try {
        // Step 1: API call
        this.events.emit(EventType.API_CALL_START, { agentIndex, attempt, prompt: prompt.userPrompt });

        const apiResponse = await this.apiClient.call(agent, prompt);

        this.events.emit(EventType.API_CALL_END, {
          agentIndex,
          durationMs: apiResponse.durationMs,
          rawContent: apiResponse.content,
        });

        // Record success with provider tracker
        tracker.recordSuccess(apiResponse.durationMs);

        // Step 2: Anti-cheat gates 1-5
        const acResult = this.anticheat.process(apiResponse.content);

        if (!acResult.passed) {
          tracker.recordFailure(FailureType.PARSE);

          this.events.emit(EventType.ANTICHEAT_FAIL, {
            agentIndex,
            gate: acResult.gateFailed,
            reason: acResult.reason,
            attempt,
          });

          if (attempt === this.config.maxRetries) {
            return {
              forfeit: true,
              failReason: `Anti-cheat: ${acResult.reason}`,
              failureType: FailureType.PARSE,
              retriesUsed: attempt,
              durationMs: Date.now() - turnStart,
            };
          }
          const retryAdvice = tracker.shouldRetry(FailureType.PARSE);
          await this.sleep(retryAdvice.waitMs);
          continue;
        }

        this.events.emit(EventType.ANTICHEAT_PASS, { agentIndex });

        if (acResult.normalizationStrategy && acResult.normalizationStrategy !== 'DIRECT_PARSE') {
          this.events.emit(EventType.NORMALIZATION_PASS, {
            agentIndex,
            strategy: acResult.normalizationStrategy,
            parsedAction: acResult.parsedAction,
          });
        }

        // Step 3: Gate 6 — Plugin move validation
        const action = acResult.parsedAction!;
        const validation = this.plugin.validateAction(gameState, action);

        if (!validation.valid) {
          tracker.recordFailure(FailureType.MOVE);

          this.events.emit(EventType.MOVE_INVALID, {
            agentIndex,
            action,
            reason: validation.reason,
            attempt,
          });

          if (attempt === this.config.maxRetries) {
            return {
              forfeit: true,
              failReason: `Illegal move after ${this.config.maxRetries} retries: ${validation.reason}`,
              failureType: FailureType.MOVE,
              retriesUsed: attempt,
              durationMs: Date.now() - turnStart,
            };
          }
          const retryAdvice = tracker.shouldRetry(FailureType.MOVE);
          await this.sleep(retryAdvice.waitMs);
          continue;
        }

        // All gates passed — valid move!
        return {
          action,
          forfeit: false,
          retriesUsed: attempt,
          durationMs: Date.now() - turnStart,
        };

      } catch (error: any) {
        // Classify the failure
        const failureType = ProviderManager.classifyError(error);
        tracker.recordFailure(failureType);

        this.logger.error('Turn execution error', {
          error: error.message,
          attempt,
          failureType,
          code: error.code,
        });

        // Non-retryable failures: immediate forfeit
        const retryAdvice = tracker.shouldRetry(failureType);
        if (!retryAdvice.retry) {
          this.logger.error(`Non-retryable failure: ${retryAdvice.reason}`);
          return {
            forfeit: true,
            failReason: retryAdvice.reason,
            failureType,
            retriesUsed: attempt,
            durationMs: Date.now() - turnStart,
          };
        }

        // Last attempt exhausted
        if (attempt === this.config.maxRetries) {
          return {
            forfeit: true,
            failReason: `${retryAdvice.reason} (${this.config.maxRetries} retries exhausted)`,
            failureType,
            retriesUsed: attempt,
            durationMs: Date.now() - turnStart,
          };
        }

        // Smart wait before retry based on failure type
        this.logger.info(`${retryAdvice.reason} — waiting ${retryAdvice.waitMs}ms`);
        await this.sleep(retryAdvice.waitMs);
      }
    }

    return {
      forfeit: true,
      failReason: 'Unknown error in turn execution',
      failureType: FailureType.SERVER,
      retriesUsed: this.config.maxRetries,
      durationMs: Date.now() - turnStart,
    };
  }

  private buildResult(
    state: SimulationState,
    result: GameResult,
    turns: TurnRecord[],
    matchStart: number,
  ): OrchestratorResult {
    return {
      state,
      result,
      turns,
      durationMs: Date.now() - matchStart,
      analytics: this.analytics,
      providerManager: this.providers,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
