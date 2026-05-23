// ================================================================
// Neural Arena - Context Compiler
// ================================================================
// Builds a structured cognitive context matrix from independent state
// sources. Text prompts are only rendered after this stage.
// ================================================================

import { AgentConfig, PromptPair } from '../core/types';
import { TacticalMemory } from '../agents/TacticalMemory';
import { ModelCognitiveCapabilities } from './ModelCapabilityRegistry';
import { PromptStrategy } from './AdaptivePromptStrategy';

export type DecisionSchemaType = 'json_object' | 'tool_call' | 'weighted_intent';

export interface ActionSchema {
  readonly name: string;
  readonly description: string;
  readonly requiredFields: readonly string[];
  readonly properties: Readonly<Record<string, { readonly type: string; readonly description: string }>>;
}

export interface DecisionSchema {
  readonly type: DecisionSchemaType;
  readonly action: ActionSchema;
  readonly strict: boolean;
  readonly outputOnly: boolean;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ActionSchema;
  readonly enabled: boolean;
}

export interface PersonaBlock {
  readonly kind: 'PersonaBlock';
  readonly agentName: string;
  readonly model: string;
  readonly personality: string;
  readonly playstyle: string;
  readonly aggression: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly riskProfile: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';
}

export interface WorldStateBlock {
  readonly kind: 'WorldStateBlock';
  readonly position: string;
  readonly color: string;
  readonly moveNumber: string;
  readonly turnNumber: number;
  readonly requestId: string;
  readonly timers: Readonly<Record<string, unknown>>;
  readonly matchMetadata: Readonly<Record<string, unknown>>;
}

export interface TacticalMemoryBlock {
  readonly kind: 'TacticalMemoryBlock';
  readonly previousFailures: readonly string[];
  readonly rejectedMoves: readonly string[];
  readonly repeatedMoves: readonly string[];
  readonly strategicObservations: readonly string[];
  readonly escalationLevel: number;
}

export interface RetrievalBlock {
  readonly kind: 'RetrievalBlock';
  readonly semanticMemories: readonly string[];
  readonly priorMatchPatterns: readonly string[];
  readonly ragEnabled: false;
  readonly placeholder: string;
}

export interface ConstraintBlock {
  readonly kind: 'ConstraintBlock';
  readonly outputSchema: DecisionSchema;
  readonly legalityConstraints: readonly string[];
  readonly antiCheatRequirements: readonly string[];
  readonly toolDefinitions: readonly ToolDefinition[];
}

export interface LegalMovesBlock {
  readonly kind: 'LegalMovesBlock';
  readonly legalMoves: readonly string[];
  readonly count: number;
}

export interface CompiledCognitiveContext {
  readonly persona: PersonaBlock;
  readonly worldState: WorldStateBlock;
  readonly tacticalMemory: TacticalMemoryBlock;
  readonly retrieval: RetrievalBlock;
  readonly constraints: ConstraintBlock;
  readonly legalMoves: LegalMovesBlock;
  readonly capabilityTier: string;
  readonly strategyId: string;
  readonly blocks: readonly ContextBlock[];
}

export type ContextBlock =
  | PersonaBlock
  | WorldStateBlock
  | TacticalMemoryBlock
  | RetrievalBlock
  | ConstraintBlock
  | LegalMovesBlock;

export interface ContextCompilerInput {
  readonly agent: AgentConfig;
  readonly basePrompt: PromptPair;
  readonly legalActions: readonly string[];
  readonly memory: TacticalMemory;
  readonly requestId: string;
  readonly turnNumber: number;
  readonly capabilities: ModelCognitiveCapabilities;
  readonly strategy: PromptStrategy;
}

interface PromptFacts {
  readonly color: string;
  readonly moveNumber: string;
  readonly position: string;
}

export class ContextCompiler {
  compile(input: ContextCompilerInput): CompiledCognitiveContext {
    const facts = this.extractFacts(input.basePrompt);
    const memorySummary = input.memory.getCorrectionSummary();
    const persona = this.buildPersonaBlock(input.agent, input.capabilities);
    const worldState = this.buildWorldStateBlock(input.requestId, input.turnNumber, facts);
    const tacticalMemory = this.buildTacticalMemoryBlock(input.memory, memorySummary);
    const retrieval = this.buildRetrievalBlock();
    const constraints = this.buildConstraintBlock(input.strategy);
    const legalMoves = Object.freeze({
      kind: 'LegalMovesBlock' as const,
      legalMoves: Object.freeze([...input.legalActions]),
      count: input.legalActions.length,
    });

    const blocks: ContextBlock[] = [persona, worldState, tacticalMemory, retrieval, constraints, legalMoves];

    return Object.freeze({
      persona,
      worldState,
      tacticalMemory,
      retrieval,
      constraints,
      legalMoves,
      capabilityTier: input.capabilities.tier,
      strategyId: input.strategy.strategyId,
      blocks: Object.freeze(blocks),
    });
  }

  private buildPersonaBlock(agent: AgentConfig, capabilities: ModelCognitiveCapabilities): PersonaBlock {
    const weak = capabilities.tier === 'TINY' || capabilities.tier === 'SMALL';

    return Object.freeze({
      kind: 'PersonaBlock',
      agentName: agent.name || `Agent ${agent.index}`,
      model: agent.model,
      personality: weak ? 'literal legal-action selector' : 'bounded strategic decision processor',
      playstyle: weak ? 'legal-first' : 'strategic but legality-first',
      aggression: capabilities.tier === 'REASONING' || capabilities.tier === 'LARGE' ? 'MEDIUM' : 'LOW',
      riskProfile: weak ? 'CONSERVATIVE' : 'BALANCED',
    });
  }

  private buildWorldStateBlock(requestId: string, turnNumber: number, facts: PromptFacts): WorldStateBlock {
    return Object.freeze({
      kind: 'WorldStateBlock',
      position: facts.position,
      color: facts.color,
      moveNumber: facts.moveNumber,
      turnNumber,
      requestId,
      timers: Object.freeze({}),
      matchMetadata: Object.freeze({
        domain: 'chess',
        authority: 'World',
      }),
    });
  }

  private buildTacticalMemoryBlock(memory: TacticalMemory, summary: ReturnType<TacticalMemory['getCorrectionSummary']>): TacticalMemoryBlock {
    const previousFailures = memory.getRecentRejections().map(attempt => {
      const repeated = attempt.count > 1 ? ` repeated ${attempt.count} times` : '';
      return `"${attempt.action}" rejected${repeated}: ${attempt.reason}`;
    });

    return Object.freeze({
      kind: 'TacticalMemoryBlock',
      previousFailures: Object.freeze(previousFailures),
      rejectedMoves: Object.freeze([...summary.rejectedMoves]),
      repeatedMoves: Object.freeze([...summary.repeatedMoves]),
      strategicObservations: Object.freeze([
        'World events, not model memory, define the current legal state.',
      ]),
      escalationLevel: summary.escalationLevel,
    });
  }

  private buildRetrievalBlock(): RetrievalBlock {
    return Object.freeze({
      kind: 'RetrievalBlock',
      semanticMemories: Object.freeze([]),
      priorMatchPatterns: Object.freeze([]),
      ragEnabled: false,
      placeholder: 'Retrieval disabled for current deterministic runtime pass.',
    });
  }

  private buildConstraintBlock(strategy: PromptStrategy): ConstraintBlock {
    const actionSchema: ActionSchema = Object.freeze({
      name: 'submit_chess_move',
      description: 'Submit one legal move selected from the current legal move list.',
      requiredFields: Object.freeze(['move']),
      properties: Object.freeze({
        move: Object.freeze({
          type: 'string',
          description: 'Exactly one current legal move.',
        }),
      }),
    });

    const outputSchema: DecisionSchema = Object.freeze({
      type: 'json_object',
      action: actionSchema,
      strict: strategy.escalationLevel >= 3,
      outputOnly: true,
    });

    return Object.freeze({
      kind: 'ConstraintBlock',
      outputSchema,
      legalityConstraints: Object.freeze([
        'Choose exactly one move from the current legalMoves block.',
        'Do not reuse rejected moves from tacticalMemory.',
        'Do not infer moves from previous board states.',
      ]),
      antiCheatRequirements: Object.freeze([
        'Return JSON only.',
        'No prose, markdown, analysis, or comments.',
        'The move field must be a string.',
      ]),
      toolDefinitions: Object.freeze([
        Object.freeze({
          name: 'submit_intent',
          description: 'Future tool-call bridge for submitting a validated move intent.',
          inputSchema: actionSchema,
          enabled: false,
        }),
      ]),
    });
  }

  private extractFacts(prompt: PromptPair): PromptFacts {
    const userPrompt = prompt.userPrompt;
    const systemPrompt = prompt.systemPrompt;
    const colorMatch = /Your color:\s*([^\n]+)/i.exec(userPrompt)
      || /playing chess as\s+([^.]+)\./i.exec(systemPrompt)
      || /You are\s+(White|Black)/i.exec(userPrompt);
    const moveNumberMatch = /Move number:\s*([^\n]+)/i.exec(userPrompt);
    const positionMatch = /Position \(FEN\):\s*([^\n]+)/i.exec(userPrompt);

    return {
      color: colorMatch ? colorMatch[1].trim() : 'the active player',
      moveNumber: moveNumberMatch ? moveNumberMatch[1].trim() : 'current',
      position: positionMatch ? positionMatch[1].trim() : 'current position',
    };
  }
}
