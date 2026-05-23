// ================================================================
// Neural Arena - Model Capability Registry
// ================================================================
// Classifies model cognition and prompt reliability. This registry
// guides prompt shape; provider transport capabilities remain in
// src/providers.
// ================================================================

import { AgentConfig } from '../core/types';

export type ModelCapabilityTier = 'TINY' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'REASONING';
export type ReliabilityBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface RuntimeFailureProfile {
  readonly rejectionCount: number;
  readonly repeatedIllegalMoves: number;
  readonly malformedJsonFailures: number;
  readonly correctionAttempts: number;
}

export interface ModelCognitiveCapabilities {
  readonly provider: string;
  readonly model: string;
  readonly tier: ModelCapabilityTier;
  readonly supportsSystemRole: boolean;
  readonly supportsJSONMode: boolean;
  readonly instructionReliability: ReliabilityBand;
  readonly legalMoveReliability: ReliabilityBand;
  readonly structuredOutputReliability: ReliabilityBand;
  readonly hallucinationRisk: RiskBand;
  readonly repetitionRisk: RiskBand;
  readonly reasons: readonly string[];
}

export class ModelCapabilityRegistry {
  classify(agent: AgentConfig, failures: RuntimeFailureProfile = this.emptyFailures()): ModelCognitiveCapabilities {
    const provider = this.detectProvider(agent.baseUrl);
    const model = agent.model.toLowerCase();
    const reasons: string[] = [];
    let tier: ModelCapabilityTier = 'MEDIUM';

    if (this.matchesAny(model, ['gemma-2b', 'gemma2:2b', '2b', 'tinyllama', 'tiny-llama', 'phi-2'])) {
      tier = 'TINY';
      reasons.push('Model name indicates a tiny or low-parameter instruction model.');
    } else if (this.matchesAny(model, ['gemma', 'phi', 'mini', 'small', '3b', '4b', '7b'])) {
      tier = 'SMALL';
      reasons.push('Model name indicates a small instruction model.');
    } else if (this.matchesAny(model, ['gpt-4', 'claude', 'glm-5', 'deepseek-r1', 'deepseek-reasoner', 'o1', 'o3', 'o4', 'reasoning'])) {
      tier = 'REASONING';
      reasons.push('Model name indicates a high-reliability reasoning model.');
    } else if (this.matchesAny(model, ['70b', '72b', '120b', '405b', 'large', 'opus', 'sonnet'])) {
      tier = 'LARGE';
      reasons.push('Model name indicates a large model.');
    }

    const supportsSystemRole = !(provider === 'nvidia' && model.includes('gemma'));
    const supportsJSONMode = !this.matchesAny(provider, ['nvidia', 'ollama', 'lmstudio', 'groq', 'together']);

    if (!supportsSystemRole) reasons.push('Provider/model combination is known to reject system role messages.');
    if (!supportsJSONMode) reasons.push('Provider/model combination should rely on prompt-level JSON instructions.');

    let instructionReliability = this.baseInstructionReliability(tier);
    let legalMoveReliability = this.baseLegalMoveReliability(tier);
    let structuredOutputReliability = this.baseStructuredOutputReliability(tier);
    let hallucinationRisk = this.baseHallucinationRisk(tier);
    let repetitionRisk = this.baseRepetitionRisk(tier);

    if (failures.rejectionCount >= 1) {
      legalMoveReliability = this.downgradeReliability(legalMoveReliability);
      hallucinationRisk = this.upgradeRisk(hallucinationRisk);
      reasons.push('Runtime rejections reduced legal move reliability.');
    }

    if (failures.repeatedIllegalMoves >= 1) {
      repetitionRisk = this.upgradeRisk(this.upgradeRisk(repetitionRisk));
      instructionReliability = this.downgradeReliability(instructionReliability);
      reasons.push('Repeated illegal move pattern detected at runtime.');
    }

    if (failures.malformedJsonFailures >= 1) {
      structuredOutputReliability = this.downgradeReliability(structuredOutputReliability);
      reasons.push('Malformed JSON failure reduced structured output reliability.');
    }

    return Object.freeze({
      provider,
      model: agent.model,
      tier,
      supportsSystemRole,
      supportsJSONMode,
      instructionReliability,
      legalMoveReliability,
      structuredOutputReliability,
      hallucinationRisk,
      repetitionRisk,
      reasons: Object.freeze(reasons),
    });
  }

  private emptyFailures(): RuntimeFailureProfile {
    return {
      rejectionCount: 0,
      repeatedIllegalMoves: 0,
      malformedJsonFailures: 0,
      correctionAttempts: 0,
    };
  }

  private detectProvider(baseUrl: string): string {
    const url = baseUrl.toLowerCase();
    if (url.includes('nvidia')) return 'nvidia';
    if (url.includes('openrouter')) return 'openrouter';
    if (url.includes('api.openai.com') || url.includes('openai.azure.com')) return 'openai';
    if (url.includes('anthropic')) return 'anthropic';
    if (url.includes('google') || url.includes('generativelanguage') || url.includes('gemini')) return 'gemini';
    if (url.includes('groq')) return 'groq';
    if (url.includes('together')) return 'together';
    if (url.includes('deepseek')) return 'deepseek';
    if (url.includes('bigmodel') || url.includes('zhipu') || url.includes('glm')) return 'glm';
    if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('::1')) return 'local';
    return 'custom';
  }

  private matchesAny(value: string, needles: string[]): boolean {
    return needles.some(needle => value.includes(needle));
  }

  private baseInstructionReliability(tier: ModelCapabilityTier): ReliabilityBand {
    if (tier === 'TINY') return 'LOW';
    if (tier === 'SMALL') return 'MEDIUM';
    if (tier === 'REASONING') return 'VERY_HIGH';
    if (tier === 'LARGE') return 'HIGH';
    return 'MEDIUM';
  }

  private baseLegalMoveReliability(tier: ModelCapabilityTier): ReliabilityBand {
    if (tier === 'TINY') return 'LOW';
    if (tier === 'SMALL') return 'MEDIUM';
    if (tier === 'REASONING') return 'VERY_HIGH';
    if (tier === 'LARGE') return 'HIGH';
    return 'MEDIUM';
  }

  private baseStructuredOutputReliability(tier: ModelCapabilityTier): ReliabilityBand {
    if (tier === 'TINY') return 'LOW';
    if (tier === 'SMALL') return 'MEDIUM';
    if (tier === 'REASONING') return 'VERY_HIGH';
    if (tier === 'LARGE') return 'HIGH';
    return 'MEDIUM';
  }

  private baseHallucinationRisk(tier: ModelCapabilityTier): RiskBand {
    if (tier === 'TINY') return 'VERY_HIGH';
    if (tier === 'SMALL') return 'HIGH';
    if (tier === 'REASONING') return 'LOW';
    if (tier === 'LARGE') return 'MEDIUM';
    return 'MEDIUM';
  }

  private baseRepetitionRisk(tier: ModelCapabilityTier): RiskBand {
    if (tier === 'TINY') return 'VERY_HIGH';
    if (tier === 'SMALL') return 'HIGH';
    if (tier === 'REASONING') return 'LOW';
    if (tier === 'LARGE') return 'MEDIUM';
    return 'MEDIUM';
  }

  private downgradeReliability(value: ReliabilityBand): ReliabilityBand {
    if (value === 'VERY_HIGH') return 'HIGH';
    if (value === 'HIGH') return 'MEDIUM';
    return 'LOW';
  }

  private upgradeRisk(value: RiskBand): RiskBand {
    if (value === 'LOW') return 'MEDIUM';
    if (value === 'MEDIUM') return 'HIGH';
    return 'VERY_HIGH';
  }
}
