// ================================================================
// Neural Arena - Adaptive Cognitive Prompt Compiler
// ================================================================
// Produces model-aware cognitive prompts from simulation prompts,
// legal actions, model capabilities, and correction memory.
// ================================================================

import { AgentConfig, PromptPair } from '../core/types';
import { TacticalMemory } from '../agents/TacticalMemory';
import { AdaptivePromptStrategy, PromptStrategy } from './AdaptivePromptStrategy';
import { ModelCapabilityRegistry, ModelCognitiveCapabilities } from './ModelCapabilityRegistry';
import { CompiledCognitiveContext, ContextCompiler } from './ContextCompiler';

export interface CognitivePromptInput {
  readonly agent: AgentConfig;
  readonly basePrompt: PromptPair;
  readonly legalActions: readonly string[];
  readonly memory: TacticalMemory;
  readonly requestId: string;
  readonly turnNumber: number;
}

export interface CognitivePromptResult {
  readonly prompt: PromptPair;
  readonly context: CompiledCognitiveContext;
  readonly capabilities: ModelCognitiveCapabilities;
  readonly strategy: PromptStrategy;
  readonly correctionApplied: boolean;
  readonly correctionText: string;
}

export class PromptCompiler {
  private readonly capabilityRegistry: ModelCapabilityRegistry;
  private readonly strategySelector: AdaptivePromptStrategy;
  private readonly contextCompiler: ContextCompiler;

  constructor(
    capabilityRegistry: ModelCapabilityRegistry = new ModelCapabilityRegistry(),
    strategySelector: AdaptivePromptStrategy = new AdaptivePromptStrategy(),
    contextCompiler: ContextCompiler = new ContextCompiler(),
  ) {
    this.capabilityRegistry = capabilityRegistry;
    this.strategySelector = strategySelector;
    this.contextCompiler = contextCompiler;
  }

  compile(input: CognitivePromptInput): CognitivePromptResult {
    const failureProfile = input.memory.getRuntimeFailureProfile();
    const capabilities = this.capabilityRegistry.classify(input.agent, failureProfile);
    const strategy = this.strategySelector.select(capabilities, input.memory);
    const context = this.contextCompiler.compile({
      agent: input.agent,
      basePrompt: input.basePrompt,
      legalActions: input.legalActions,
      memory: input.memory,
      requestId: input.requestId,
      turnNumber: input.turnNumber,
      capabilities,
      strategy,
    });
    const correctionText = input.memory.formatCorrectionBlock(context.tacticalMemory.escalationLevel);

    const prompt = this.buildPrompt(
      input.basePrompt,
      context,
      correctionText,
      strategy,
      capabilities,
    );

    return Object.freeze({
      prompt,
      context,
      capabilities,
      strategy,
      correctionApplied: correctionText.length > 0,
      correctionText,
    });
  }

  private buildPrompt(
    basePrompt: PromptPair,
    context: CompiledCognitiveContext,
    correctionText: string,
    strategy: PromptStrategy,
    capabilities: ModelCognitiveCapabilities,
  ): PromptPair {
    const worldState = context.worldState;
    const legalActions = context.legalMoves.legalMoves;
    const persona = context.persona;
    const constraints = context.constraints;

    if (strategy.mode === 'FORCED_CONSTRAINED') {
      return {
        systemPrompt: `You are a deterministic legal-action selector for ${worldState.color}.`,
        userPrompt: [
          `COGNITIVE CONTEXT MATRIX`,
          `Persona: ${persona.personality}; playstyle=${persona.playstyle}; risk=${persona.riskProfile}`,
          `Request: ${worldState.requestId}`,
          `Turn: ${worldState.turnNumber}`,
          `Color: ${worldState.color}`,
          correctionText,
          `LEGAL MOVES:`,
          this.formatLegalMoves(legalActions, strategy),
          ``,
          `Constraints:`,
          ...constraints.legalityConstraints.map(item => `- ${item}`),
          ...constraints.antiCheatRequirements.map(item => `- ${item}`),
          ``,
          `Return EXACTLY one move from above.`,
          `Return ONLY JSON:`,
          `{`,
          `  "move": "chosen_legal_move"`,
          `}`,
        ].filter(Boolean).join('\n'),
      };
    }

    if (strategy.mode === 'MINIMAL_DETERMINISTIC' || strategy.mode === 'STRICT_CORRECTION' || strategy.mode === 'WEAK_SIMPLE') {
      return {
        systemPrompt: [
          `You are ${worldState.color}.`,
          `Choose one legal chess move.`,
          `Return only JSON.`,
        ].join('\n'),
        userPrompt: [
          `COGNITIVE CONTEXT MATRIX`,
          `Persona: ${persona.personality}; playstyle=${persona.playstyle}; risk=${persona.riskProfile}`,
          `World: color=${worldState.color}; move=${worldState.moveNumber}; request=${worldState.requestId}`,
          ``,
          `Choose ONLY ONE move from LEGAL MOVES below.`,
          `If you choose a move not in the list, you immediately lose.`,
          correctionText,
          `LEGAL MOVES:`,
          this.formatLegalMoves(legalActions, strategy),
          ``,
          `Return ONLY JSON:`,
          `{`,
          `  "move": "chosen_legal_move"`,
          `}`,
        ].filter(Boolean).join('\n'),
      };
    }

    return {
      systemPrompt: [
        `You are playing chess as ${worldState.color}.`,
        `Select exactly one legal move from the current legal move list.`,
        `Return only a JSON object with a move field.`,
        `Do not include reasoning or prose.`,
        `Model cognition tier: ${capabilities.tier}.`,
      ].join('\n'),
      userPrompt: [
        `COGNITIVE CONTEXT MATRIX`,
        `Persona: ${persona.personality}; playstyle=${persona.playstyle}; risk=${persona.riskProfile}; aggression=${persona.aggression}`,
        `World State:`,
        `- Position (FEN): ${worldState.position}`,
        `- Move number: ${worldState.moveNumber}`,
        `- Turn number: ${worldState.turnNumber}`,
        `- Your color: ${worldState.color}`,
        `- Request: ${worldState.requestId}`,
        correctionText,
        `Legal Moves: ${this.formatLegalMoves(legalActions, strategy)}`,
        `Constraints:`,
        ...constraints.legalityConstraints.map(item => `- ${item}`),
        ...constraints.antiCheatRequirements.map(item => `- ${item}`),
        `Retrieval: ${context.retrieval.placeholder}`,
        ``,
        `Return JSON:`,
        `{`,
        `  "move": "<LEGAL_MOVE>"`,
        `}`,
      ].filter(Boolean).join('\n') || basePrompt.userPrompt,
    };
  }

  private formatLegalMoves(legalActions: readonly string[], strategy: PromptStrategy): string {
    if (strategy.numberLegalMoves) {
      return legalActions.map((move, index) => `${index + 1}. ${move}`).join('\n');
    }

    if (strategy.useBulletLegalMoves) {
      return legalActions.map(move => `- ${move}`).join('\n');
    }

    const lines: string[] = [];
    for (let i = 0; i < legalActions.length; i += strategy.maxLegalMovesPerLine) {
      lines.push(legalActions.slice(i, i + strategy.maxLegalMovesPerLine).join(', '));
    }
    return lines.join('\n');
  }
}
