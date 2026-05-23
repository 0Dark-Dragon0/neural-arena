// ================================================================
// Neural Arena — Cognitive Agent
// ================================================================

import { BaseAgent } from './BaseAgent';
import { EventBus, SimulationEvent, EventPayload, SimulationEventPayload } from '../engine/EventBus';
import { IntentGateway } from '../engine/IntentGateway';
import { TacticalMemory } from './TacticalMemory';
import { APIWorker } from '../providers/APIWorker';
import { AgentConfig, PromptPair, LogLevel } from '../core/types';
import { AntiCheatPipeline } from '../core/anticheat';
import { Logger } from '../core/logger';
import { IntentCausalityContext } from '../engine/IntentValidator';
import { PromptCompiler as CognitivePromptCompiler, CognitivePromptResult } from '../cognition/PromptCompiler';
import { CognitiveCorrection } from '../cognition/CognitiveCorrection';

type AgentLifecycleState = 'IDLE' | 'THINKING' | 'SUBMITTED' | 'REJECTED' | 'FORFEITED' | 'ERROR';

export class CognitiveAgent extends BaseAgent {
  private config: AgentConfig;
  private worker: APIWorker;
  private memory: TacticalMemory;
  private logger: Logger;
  private isThinking: boolean = false;
  private anticheat: AntiCheatPipeline;
  private retries: number = 0;
  private maxRetries: number;
  private lifecycleState: AgentLifecycleState = 'IDLE';
  private activeRequest: IntentCausalityContext | null = null;
  private pendingForfeitReason: string | null = null;
  private cognitivePromptCompiler: CognitivePromptCompiler;
  private cognitiveCorrection: CognitiveCorrection;

  constructor(
    agentIndex: number,
    config: AgentConfig,
    eventBus: EventBus,
    intentGateway: IntentGateway,
    worker: APIWorker,
    anticheat: AntiCheatPipeline,
    maxRetries: number = 3
  ) {
    super(agentIndex, eventBus, intentGateway);
    this.config = config;
    this.worker = worker;
    this.memory = new TacticalMemory();
    this.anticheat = anticheat;
    this.logger = new Logger(LogLevel.INFO, `${process.cwd()}/logs`);
    this.maxRetries = maxRetries;
    this.cognitivePromptCompiler = new CognitivePromptCompiler();
    this.cognitiveCorrection = new CognitiveCorrection();
  }

  protected handleEvent(payload: SimulationEventPayload | EventPayload): void {
    if (payload.type === SimulationEvent.WORLD_WAITING_FOR_INTENT) {
      if (payload.data.agentIndex === this.agentIndex) {
        const causality = this.extractCausality(payload);

        if (this.isThinking) {
          this.eventBus.emit(
            SimulationEvent.AGENT_THINK_SUPPRESSED,
            payload.tick,
            {
              agentIndex: this.agentIndex,
              lifecycleState: this.lifecycleState,
              activeRequest: this.activeRequest,
              incomingRequest: causality,
              reason: 'Agent is already processing an earlier request',
            },
            this.intentGateway.getSimulationTimeMs(),
            this.intentGateway.getWallTimestampMs(),
            causality.sourceEventId,
          );
          return;
        }

        this.activeRequest = causality;
        this.memory.beginTurn(causality.turnNumber);

        if (this.pendingForfeitReason) {
          const reason = this.pendingForfeitReason;
          this.pendingForfeitReason = null;
          this.setLifecycle('FORFEITED', payload.tick, causality.sourceEventId, { requestId: causality.requestId, reason });
          this.submitIntent('FORFEIT', { reason }, causality);
          return;
        }

        // It's our turn.
        const legalActions = Array.isArray(payload.data.legalActions)
          ? payload.data.legalActions.map((action: unknown) => String(action))
          : [];
        const compiledPrompt = this.cognitivePromptCompiler.compile({
          agent: this.config,
          basePrompt: payload.data.prompt as PromptPair,
          legalActions,
          memory: this.memory,
          requestId: causality.requestId,
          turnNumber: causality.turnNumber,
        });

        this.emitContextCompilation(compiledPrompt, payload.tick, causality);
        this.emitPromptStrategy(compiledPrompt, payload.tick, causality);

        this.setLifecycle('THINKING', payload.tick, causality.sourceEventId, { requestId: causality.requestId });
        this.think(compiledPrompt.prompt, causality, compiledPrompt.strategy.strategyId);
      }
    } else if (payload.type === SimulationEvent.INTENT_REJECTED) {
      if (payload.data.agentIndex === this.agentIndex) {
        if (payload.data.stale) {
          this.setLifecycle(this.lifecycleState, payload.tick, (payload as SimulationEventPayload).eventId || null, {
            ignoredRequestId: payload.data.requestId,
            reason: 'Ignoring stale timeline rejection for cognition memory',
          });
          return;
        }

        if (payload.data.requestId && this.activeRequest && payload.data.requestId !== this.activeRequest.requestId) {
          this.setLifecycle(this.lifecycleState, payload.tick, (payload as SimulationEventPayload).eventId || null, {
            ignoredRequestId: payload.data.requestId,
            activeRequestId: this.activeRequest.requestId,
            reason: 'Ignoring rejection for stale request context',
          });
          return;
        }

        // Our move was rejected. Convert this into deterministic correction memory.
        const correction = this.cognitiveCorrection.applyRejection(this.memory, {
          action: String(payload.data.action),
          reason: String(payload.data.reason),
          tick: payload.tick,
          requestId: payload.data.requestId ? String(payload.data.requestId) : undefined,
        });

        this.retries++;
        this.emitCorrectionEvents(correction, payload.tick, (payload as SimulationEventPayload).eventId || null, payload.data.requestId as string | undefined);
        this.setLifecycle('REJECTED', payload.tick, (payload as SimulationEventPayload).eventId || null, {
          requestId: payload.data.requestId,
          reason: payload.data.reason,
          retries: this.retries,
        });
        
        if (this.retries > this.maxRetries) {
          // Submit forfeit only after the world issues the next request, so the
          // forfeit carries fresh causal state instead of the rejected request.
          this.pendingForfeitReason = `Max retries (${this.maxRetries}) exceeded. Last failure: ${payload.data.reason}`;
        }
        // If we haven't exceeded max retries, we expect the world to re-emit WORLD_WAITING_FOR_INTENT
      }
    } else if (payload.type === SimulationEvent.INTENT_ACCEPTED) {
      if (payload.data.agentIndex === this.agentIndex) {
        // Turn successful
        this.memory.clear();
        this.retries = 0;
        this.activeRequest = null;
        this.setLifecycle('IDLE', payload.tick, (payload as SimulationEventPayload).eventId || null, {
          requestId: payload.data.requestId,
          intentId: payload.data.intentId,
        });
      }
    }
  }

  private async think(basePrompt: PromptPair, causality: IntentCausalityContext, promptStrategyId: string): Promise<void> {
    if (this.isThinking) {
      this.eventBus.emit(
        SimulationEvent.AGENT_THINK_SUPPRESSED,
        this.intentGateway.getCurrentTick(),
        {
          agentIndex: this.agentIndex,
          lifecycleState: this.lifecycleState,
          activeRequest: this.activeRequest,
          incomingRequest: causality,
          reason: 'Duplicate think invocation suppressed',
        },
        this.intentGateway.getSimulationTimeMs(),
        this.intentGateway.getWallTimestampMs(),
        causality.sourceEventId,
      );
      return;
    }

    this.isThinking = true;

    // Apply exponential backoff if this is a retry (helps prevent 429 spam storms)
    if (this.retries > 0) {
      const backoffMs = Math.min(1000 * Math.pow(2, this.retries), 10000);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }

    this.eventBus.emit(
      SimulationEvent.AGENT_THINKING,
      this.intentGateway.getCurrentTick(),
      {
        agentIndex: this.agentIndex,
        requestId: causality.requestId,
        sourceEventId: causality.sourceEventId,
        turnNumber: causality.turnNumber,
        stateNodeId: causality.stateNodeId,
        stateHash: causality.stateHash,
        promptStrategyId,
      },
      this.intentGateway.getSimulationTimeMs(),
      this.intentGateway.getWallTimestampMs(),
      causality.sourceEventId,
    );

    const prompt = basePrompt;

    try {
      this.eventBus.emit(
        SimulationEvent.API_REQUEST_START,
        this.intentGateway.getCurrentTick(),
        {
          agentIndex: this.agentIndex,
          requestId: causality.requestId,
          sourceEventId: causality.sourceEventId,
          turnNumber: causality.turnNumber,
          stateNodeId: causality.stateNodeId,
          stateHash: causality.stateHash,
          promptStrategyId,
          prompt: prompt.userPrompt,
        },
        this.intentGateway.getSimulationTimeMs(),
        this.intentGateway.getWallTimestampMs(),
        causality.sourceEventId,
      );
      
      // Async API Call (does not block TickLoop)
      const apiResponse = await this.worker.executeTask(this.config, prompt, {
        agentIndex: this.agentIndex,
        requestId: causality.requestId,
        sourceEventId: causality.sourceEventId,
        turnNumber: causality.turnNumber,
        stateNodeId: causality.stateNodeId,
        stateHash: causality.stateHash,
      });
      
      this.eventBus.emit(
        SimulationEvent.API_RESPONSE_RECEIVED,
        this.intentGateway.getCurrentTick(),
        {
          agentIndex: this.agentIndex,
          requestId: causality.requestId,
          sourceEventId: causality.sourceEventId,
          turnNumber: causality.turnNumber,
          stateNodeId: causality.stateNodeId,
          stateHash: causality.stateHash,
          rawContent: apiResponse.content,
        },
        this.intentGateway.getSimulationTimeMs(),
        this.intentGateway.getWallTimestampMs(),
        causality.sourceEventId,
      );

      // Process through AntiCheat (normalization, parsing)
      const acResult = this.anticheat.process(apiResponse.content);
      
      if (acResult.passed && acResult.parsedAction) {
        this.eventBus.emit(
          SimulationEvent.ANTICHEAT_PASS,
          this.intentGateway.getCurrentTick(),
          {
            agentIndex: this.agentIndex,
            requestId: causality.requestId,
            parsedAction: acResult.parsedAction,
            normalizationStrategy: acResult.normalizationStrategy,
          },
          this.intentGateway.getSimulationTimeMs(),
          this.intentGateway.getWallTimestampMs(),
          causality.sourceEventId,
        );

        if (acResult.normalizationStrategy && acResult.normalizationStrategy !== 'DIRECT_PARSE') {
          this.eventBus.emit(
            SimulationEvent.NORMALIZATION_RECOVERY,
            this.intentGateway.getCurrentTick(),
            {
              agentIndex: this.agentIndex,
              requestId: causality.requestId,
              strategy: acResult.normalizationStrategy,
              parsedAction: acResult.parsedAction,
            },
            this.intentGateway.getSimulationTimeMs(),
            this.intentGateway.getWallTimestampMs(),
            causality.sourceEventId,
          );
        }

        const intentId = this.submitIntent('SUBMIT_ACTION', { action: acResult.parsedAction }, causality);
        this.setLifecycle('SUBMITTED', this.intentGateway.getCurrentTick(), causality.sourceEventId, {
          requestId: causality.requestId,
          intentId,
        });
      } else {
        this.eventBus.emit(
          SimulationEvent.ANTICHEAT_FAIL,
          this.intentGateway.getCurrentTick(),
          {
            agentIndex: this.agentIndex,
            requestId: causality.requestId,
            gate: acResult.gateFailed,
            reason: acResult.reason,
          },
          this.intentGateway.getSimulationTimeMs(),
          this.intentGateway.getWallTimestampMs(),
          causality.sourceEventId,
        );

        // If AntiCheat rejects it before it even reaches the world rules
        // we can self-correct by recording it in tactical memory and submitting a dummy intent
        // so the World rejects it and increments retries.
        const intentId = this.submitIntent('SUBMIT_ACTION', { action: 'INVALID_PARSE', reason: acResult.reason }, causality);
        this.setLifecycle('SUBMITTED', this.intentGateway.getCurrentTick(), causality.sourceEventId, {
          requestId: causality.requestId,
          intentId,
          reason: acResult.reason,
        });
      }

    } catch (error: any) {
      this.eventBus.emit(
        SimulationEvent.AGENT_ERROR,
        this.intentGateway.getCurrentTick(),
        {
          agentIndex: this.agentIndex,
          requestId: causality.requestId,
          error: error.message,
          code: error.code,
        },
        this.intentGateway.getSimulationTimeMs(),
        this.intentGateway.getWallTimestampMs(),
        causality.sourceEventId,
      );
      this.setLifecycle('ERROR', this.intentGateway.getCurrentTick(), causality.sourceEventId, {
        requestId: causality.requestId,
        error: error.message,
        code: error.code,
      });
      // Tell the world we failed (acts as an intent to forfeit/retry)
      this.submitIntent('API_ERROR', { error: error.message, code: error.code }, causality);
    } finally {
      this.isThinking = false;
    }
  }

  private extractCausality(payload: SimulationEventPayload | EventPayload): IntentCausalityContext {
    return {
      requestId: String(payload.data.requestId),
      sourceEventId: (payload as SimulationEventPayload).eventId || String(payload.data.sourceEventId || 'event-missing'),
      agentIndex: Number(payload.data.agentIndex),
      turnNumber: Number(payload.data.turnNumber),
      originTick: Number(payload.data.originTick ?? payload.tick),
      stateNodeId: String(payload.data.stateNodeId),
      stateHash: String(payload.data.stateHash),
    };
  }

  private setLifecycle(
    nextState: AgentLifecycleState,
    tick: number,
    causedByEventId: string | null,
    data: Record<string, any> = {},
  ): void {
    const previous = this.lifecycleState;
    this.lifecycleState = nextState;

    this.eventBus.emit(
      SimulationEvent.AGENT_LIFECYCLE_UPDATED,
      tick,
      {
        agentIndex: this.agentIndex,
        from: previous,
        to: nextState,
        ...data,
      },
      this.intentGateway.getSimulationTimeMs(),
      this.intentGateway.getWallTimestampMs(),
      causedByEventId,
    );
  }

  private emitPromptStrategy(result: CognitivePromptResult, tick: number, causality: IntentCausalityContext): void {
    this.eventBus.emit(
      SimulationEvent.PROMPT_STRATEGY_SELECTED,
      tick,
      {
        agentIndex: this.agentIndex,
        requestId: causality.requestId,
        strategyId: result.strategy.strategyId,
        mode: result.strategy.mode,
        escalationLevel: result.strategy.escalationLevel,
        reason: result.strategy.reason,
        modelTier: result.capabilities.tier,
        provider: result.capabilities.provider,
        model: result.capabilities.model,
        instructionReliability: result.capabilities.instructionReliability,
        legalMoveReliability: result.capabilities.legalMoveReliability,
        hallucinationRisk: result.capabilities.hallucinationRisk,
        repetitionRisk: result.capabilities.repetitionRisk,
        correctionApplied: result.correctionApplied,
      },
      this.intentGateway.getSimulationTimeMs(),
      this.intentGateway.getWallTimestampMs(),
      causality.sourceEventId,
    );

    if (result.correctionApplied) {
      this.eventBus.emit(
        SimulationEvent.COGNITIVE_CORRECTION_APPLIED,
        tick,
        {
          agentIndex: this.agentIndex,
          requestId: causality.requestId,
          strategyId: result.strategy.strategyId,
          escalationLevel: result.strategy.escalationLevel,
          correctionText: result.correctionText,
          correctionSummary: this.memory.getCorrectionSummary(),
        },
        this.intentGateway.getSimulationTimeMs(),
        this.intentGateway.getWallTimestampMs(),
        causality.sourceEventId,
      );
    }
  }

  private emitContextCompilation(result: CognitivePromptResult, tick: number, causality: IntentCausalityContext): void {
    const context = result.context;

    this.eventBus.emit(
      SimulationEvent.FSM_NODE_EXECUTED,
      tick,
      {
        agentIndex: this.agentIndex,
        requestId: causality.requestId,
        nodeId: 'context-compile',
        nodeKind: 'COGNITIVE',
        strategyId: result.strategy.strategyId,
      },
      this.intentGateway.getSimulationTimeMs(),
      this.intentGateway.getWallTimestampMs(),
      causality.sourceEventId,
    );

    this.eventBus.emit(
      SimulationEvent.CONTEXT_COMPILED,
      tick,
      {
        agentIndex: this.agentIndex,
        requestId: causality.requestId,
        strategyId: result.strategy.strategyId,
        capabilityTier: context.capabilityTier,
        blockKinds: context.blocks.map(block => block.kind),
        legalMoveCount: context.legalMoves.count,
        worldState: context.worldState,
        decisionSchema: context.constraints.outputSchema,
      },
      this.intentGateway.getSimulationTimeMs(),
      this.intentGateway.getWallTimestampMs(),
      causality.sourceEventId,
    );

    this.eventBus.emit(
      SimulationEvent.PERSONA_BLOCK_INJECTED,
      tick,
      {
        agentIndex: this.agentIndex,
        requestId: causality.requestId,
        persona: context.persona,
      },
      this.intentGateway.getSimulationTimeMs(),
      this.intentGateway.getWallTimestampMs(),
      causality.sourceEventId,
    );

    if (context.tacticalMemory.previousFailures.length > 0 || context.tacticalMemory.rejectedMoves.length > 0) {
      this.eventBus.emit(
        SimulationEvent.MEMORY_BLOCK_INJECTED,
        tick,
        {
          agentIndex: this.agentIndex,
          requestId: causality.requestId,
          tacticalMemory: context.tacticalMemory,
        },
        this.intentGateway.getSimulationTimeMs(),
        this.intentGateway.getWallTimestampMs(),
        causality.sourceEventId,
      );
    }

    this.eventBus.emit(
      SimulationEvent.CONSTRAINT_BLOCK_INJECTED,
      tick,
      {
        agentIndex: this.agentIndex,
        requestId: causality.requestId,
        constraints: context.constraints,
      },
      this.intentGateway.getSimulationTimeMs(),
      this.intentGateway.getWallTimestampMs(),
      causality.sourceEventId,
    );

    this.eventBus.emit(
      SimulationEvent.COGNITIVE_GRAPH_TRANSITION,
      tick,
      {
        agentIndex: this.agentIndex,
        requestId: causality.requestId,
        from: 'context-compile',
        to: 'provider-request',
        transitionKey: result.strategy.strategyId,
      },
      this.intentGateway.getSimulationTimeMs(),
      this.intentGateway.getWallTimestampMs(),
      causality.sourceEventId,
    );
  }

  private emitCorrectionEvents(
    correction: ReturnType<CognitiveCorrection['applyRejection']>,
    tick: number,
    causedByEventId: string | null,
    requestId?: string,
  ): void {
    this.eventBus.emit(
      SimulationEvent.COGNITIVE_CORRECTION_APPLIED,
      tick,
      {
        agentIndex: this.agentIndex,
        requestId,
        kind: correction.kind,
        rejectedMove: correction.rejectedMove,
        repeatedMoveCount: correction.repeatedMoveCount,
        illegalMoveFrequency: correction.illegalMoveFrequency,
        correctionAttempts: correction.correctionAttempts,
        escalationLevel: correction.escalationLevel,
        correctionText: correction.correctionText,
      },
      this.intentGateway.getSimulationTimeMs(),
      this.intentGateway.getWallTimestampMs(),
      causedByEventId,
    );

    if (correction.escalationChanged) {
      this.eventBus.emit(
        SimulationEvent.PROMPT_ESCALATION_LEVEL_CHANGED,
        tick,
        {
          agentIndex: this.agentIndex,
          requestId,
          from: correction.previousEscalationLevel,
          to: correction.escalationLevel,
          rejectedMove: correction.rejectedMove,
          reason: correction.correctionText,
        },
        this.intentGateway.getSimulationTimeMs(),
        this.intentGateway.getWallTimestampMs(),
        causedByEventId,
      );
    }

    if (correction.patternDetected) {
      this.eventBus.emit(
        SimulationEvent.ILLEGAL_MOVE_PATTERN_DETECTED,
        tick,
        {
          agentIndex: this.agentIndex,
          requestId,
          rejectedMove: correction.rejectedMove,
          repeatedMoveCount: correction.repeatedMoveCount,
          illegalMoveFrequency: correction.illegalMoveFrequency,
          escalationLevel: correction.escalationLevel,
        },
        this.intentGateway.getSimulationTimeMs(),
        this.intentGateway.getWallTimestampMs(),
        causedByEventId,
      );
    }
  }
}
