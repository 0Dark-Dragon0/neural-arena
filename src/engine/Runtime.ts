// ================================================================
// Neural Arena — Autonomous Simulation Runtime
// ================================================================
// The main bootloader for the deterministic simulation environment.
// ================================================================

import { EventBus, SimulationEvent } from './EventBus';
import { SimulationClock } from './SimulationClock';
import { TickScheduler } from './TickScheduler';
import { IntentGateway } from './IntentGateway';
import { BattlefieldWorld } from '../simulation/BattlefieldWorld';
import { Battlefield } from '../simulation/Battlefield';
import { AgentConfig, SimulationConfig } from '../core/types';
import { CognitiveAgent } from '../agents/CognitiveAgent';
import { APIWorker } from '../providers/APIWorker';
import { ApiClient } from '../core/api-client';
import { AntiCheatPipeline } from '../core/anticheat';
import { Logger } from '../core/logger';
import { MatchTracer } from '../core/tracer';
import { Recorder } from '../core/recorder';
import { ProviderCompatibilityTraceEvent } from '../providers/ProviderAdapter';

export class Runtime {
  private eventBus: EventBus;
  private clock: SimulationClock;
  private tickScheduler: TickScheduler;
  private intentGateway: IntentGateway;
  private world: BattlefieldWorld;
  private agents: CognitiveAgent[] = [];
  private logger: Logger;

  constructor(
    plugin: Battlefield,
    agentConfigs: AgentConfig[],
    config: SimulationConfig,
    logger: Logger,
    projectDir: string
  ) {
    this.logger = logger;
    this.eventBus = new EventBus();
    this.clock = new SimulationClock(config.tickRateMs || 100);
    this.intentGateway = new IntentGateway(this.eventBus, this.clock);
    this.world = new BattlefieldWorld(this.eventBus, this.intentGateway, plugin);
    
    this.tickScheduler = new TickScheduler(this.clock, this.eventBus, this.world);

    // Initialize Observability Systems
    const agentNames = agentConfigs.map(a => ({ name: a.name, model: a.model }));
    new MatchTracer(projectDir, this.eventBus, agentNames);
    new Recorder(projectDir, this.eventBus, plugin as any, agentNames);

    this.setupAgents(agentConfigs, config, plugin);
    this.setupLogging();
  }

  private setupAgents(agentConfigs: AgentConfig[], config: SimulationConfig, plugin: Battlefield) {
    for (let i = 0; i < agentConfigs.length; i++) {
      const apiClient = new ApiClient(config, this.logger, (event) => this.emitProviderCompatibilityEvent(event));
      const worker = new APIWorker(apiClient);
      const anticheat = new AntiCheatPipeline(plugin as any, config, this.logger);
      
      const agent = new CognitiveAgent(
        i,
        agentConfigs[i],
        this.eventBus,
        this.intentGateway,
        worker,
        anticheat
      );
      this.agents.push(agent);
    }
  }

  private setupLogging() {
    this.eventBus.subscribeAll((payload) => {
      // Basic logging of the simulation
      if (payload.type === SimulationEvent.AGENT_ERROR) {
        this.logger.error(`[Simulation] Agent Error`, payload.data);
      }
      if (
        payload.type === SimulationEvent.PROVIDER_FALLBACK_ACTIVATED ||
        payload.type === SimulationEvent.PROVIDER_UNSUPPORTED_FEATURE_HANDLED
      ) {
        this.logger.warn(`[ProviderCompatibility] ${payload.type}`, payload.data);
      }
      if (payload.type === SimulationEvent.PROMPT_STRATEGY_SELECTED) {
        this.logger.info(`[Cognition] Prompt strategy selected`, payload.data);
      }
      if (payload.type === SimulationEvent.COGNITIVE_CORRECTION_APPLIED) {
        this.logger.warn(`[Cognition] Correction applied`, payload.data);
      }
      if (payload.type === SimulationEvent.PROMPT_ESCALATION_LEVEL_CHANGED) {
        this.logger.warn(`[Cognition] Prompt escalation changed`, payload.data);
      }
      if (payload.type === SimulationEvent.ILLEGAL_MOVE_PATTERN_DETECTED) {
        this.logger.warn(`[Cognition] Illegal move pattern detected`, payload.data);
      }
      if (payload.type === SimulationEvent.CONTEXT_COMPILED) {
        this.logger.info(`[Cognition] Context compiled`, payload.data);
      }
      if (
        payload.type === SimulationEvent.MEMORY_BLOCK_INJECTED ||
        payload.type === SimulationEvent.PERSONA_BLOCK_INJECTED ||
        payload.type === SimulationEvent.CONSTRAINT_BLOCK_INJECTED
      ) {
        this.logger.debug(`[Cognition] Context block injected`, payload.data);
      }
      if (
        payload.type === SimulationEvent.COGNITIVE_GRAPH_TRANSITION ||
        payload.type === SimulationEvent.FSM_NODE_EXECUTED
      ) {
        this.logger.debug(`[CognitionGraph] ${payload.type}`, payload.data);
      }
      if (payload.type === SimulationEvent.MATCH_OVER) {
        this.logger.info(`[Simulation] Match Over!`, payload.data);
        this.stop();
      }
    });
  }

  private emitProviderCompatibilityEvent(event: ProviderCompatibilityTraceEvent): void {
    this.eventBus.emit(
      this.mapCompatibilityEvent(event.type),
      this.clock.getTick(),
      {
        code: event.code,
        message: event.message,
        provider: event.provider,
        model: event.model,
        requestId: event.requestId,
        agentIndex: event.agentIndex,
        turnNumber: event.turnNumber,
        stateNodeId: event.stateNodeId,
        stateHash: event.stateHash,
        ...event.data,
      },
      this.clock.getSimulationTimeMs(),
      Number(this.clock.getWallTimeNs() / 1_000_000n),
      event.sourceEventId ?? null,
    );
  }

  private mapCompatibilityEvent(type: ProviderCompatibilityTraceEvent['type']): SimulationEvent {
    switch (type) {
      case 'CAPABILITY_LOOKUP':
        return SimulationEvent.PROVIDER_CAPABILITY_LOOKUP;
      case 'PROVIDER_ADAPTATION':
        return SimulationEvent.PROVIDER_ADAPTATION;
      case 'PROMPT_TRANSFORMED':
        return SimulationEvent.PROVIDER_PROMPT_TRANSFORMED;
      case 'FALLBACK_ACTIVATED':
        return SimulationEvent.PROVIDER_FALLBACK_ACTIVATED;
      case 'UNSUPPORTED_FEATURE_HANDLED':
        return SimulationEvent.PROVIDER_UNSUPPORTED_FEATURE_HANDLED;
      case 'COMPATIBILITY_DECISION':
      default:
        return SimulationEvent.PROVIDER_COMPATIBILITY_DECISION;
    }
  }

  start() {
    this.logger.info('Starting Autonomous Simulation Runtime...');
    this.tickScheduler.start();
  }

  stop() {
    this.logger.info('Stopping Simulation Runtime...');
    this.tickScheduler.stop();
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }
}
