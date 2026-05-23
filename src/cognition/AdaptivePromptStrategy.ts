// ================================================================
// Neural Arena - Adaptive Prompt Strategy
// ================================================================
// Selects prompt strictness and formatting from model capabilities
// plus runtime correction memory.
// ================================================================

import { TacticalMemory } from '../agents/TacticalMemory';
import { ModelCognitiveCapabilities } from './ModelCapabilityRegistry';

export type PromptMode =
  | 'WEAK_SIMPLE'
  | 'STRONG_STRATEGIC'
  | 'STRICT_CORRECTION'
  | 'MINIMAL_DETERMINISTIC'
  | 'FORCED_CONSTRAINED';

export interface PromptStrategy {
  readonly strategyId: string;
  readonly mode: PromptMode;
  readonly escalationLevel: number;
  readonly useBulletLegalMoves: boolean;
  readonly numberLegalMoves: boolean;
  readonly includeStrategicContext: boolean;
  readonly maxLegalMovesPerLine: number;
  readonly reason: string;
}

export class AdaptivePromptStrategy {
  select(capabilities: ModelCognitiveCapabilities, memory: TacticalMemory): PromptStrategy {
    const escalationLevel = memory.getEscalationLevel();
    const weakModel = capabilities.tier === 'TINY' || capabilities.tier === 'SMALL';

    if (escalationLevel >= 4) {
      return this.strategy('forced-constrained-v4', 'FORCED_CONSTRAINED', escalationLevel, true, true, false, 1,
        'Repeated failures reached forced constrained mode.');
    }

    if (escalationLevel >= 3) {
      return this.strategy('minimal-deterministic-v3', 'MINIMAL_DETERMINISTIC', escalationLevel, true, true, false, 1,
        'Correction escalation requires minimal deterministic prompt.');
    }

    if (escalationLevel >= 2) {
      return this.strategy('strict-correction-v2', 'STRICT_CORRECTION', escalationLevel, true, false, false, 1,
        'Repeated rejection requires strong warning and legal move bullets.');
    }

    if (weakModel) {
      return this.strategy('weak-simple-v1', 'WEAK_SIMPLE', escalationLevel, true, false, false, 1,
        'Model capability tier favors simple legal move bullets.');
    }

    return this.strategy('strong-strategic-v1', 'STRONG_STRATEGIC', escalationLevel, false, false, true, 8,
      'Model capability tier can handle compressed legal move formatting.');
  }

  private strategy(
    strategyId: string,
    mode: PromptMode,
    escalationLevel: number,
    useBulletLegalMoves: boolean,
    numberLegalMoves: boolean,
    includeStrategicContext: boolean,
    maxLegalMovesPerLine: number,
    reason: string,
  ): PromptStrategy {
    return Object.freeze({
      strategyId,
      mode,
      escalationLevel,
      useBulletLegalMoves,
      numberLegalMoves,
      includeStrategicContext,
      maxLegalMovesPerLine,
      reason,
    });
  }
}
