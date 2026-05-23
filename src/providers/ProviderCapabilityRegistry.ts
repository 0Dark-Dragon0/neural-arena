// ================================================================
// Neural Arena - Provider Capability Registry
// ================================================================
// Deterministic provider/model capability lookup. Specific rules
// appear before generic provider fallbacks.
// ================================================================

import { AgentConfig } from '../core/types';
import { CapabilityResolution, ProviderCapabilities } from './ProviderAdapter';

const OPENAI_COMPATIBLE_DEFAULT: Omit<ProviderCapabilities, 'provider' | 'modelPattern'> = {
  supportsSystemRole: true,
  supportsStreaming: true,
  supportsJsonMode: true,
  supportsTools: true,
  supportsVision: false,
  supportsMultiTurn: true,
  supportsFunctionCalling: true,
  apiFormat: 'openai-chat-completions',
  streamParameter: 'include_false',
};

const NO_SYSTEM_ROLE_TEXT_MODEL: Omit<ProviderCapabilities, 'provider' | 'modelPattern'> = {
  ...OPENAI_COMPATIBLE_DEFAULT,
  supportsSystemRole: false,
  supportsStreaming: false,
  supportsJsonMode: false,
  supportsTools: false,
  supportsFunctionCalling: false,
};

export class ProviderCapabilityRegistry {
  private readonly rules: ProviderCapabilities[];

  constructor(rules: ProviderCapabilities[] = []) {
    this.rules = [
      ...rules,
      {
        provider: 'nvidia',
        modelPattern: 'google/gemma',
        ...NO_SYSTEM_ROLE_TEXT_MODEL,
        notes: ['NVIDIA-hosted Gemma variants reject chat messages with role "system".'],
      },
      {
        provider: 'nvidia',
        modelPattern: 'gemma',
        ...NO_SYSTEM_ROLE_TEXT_MODEL,
        notes: ['Gemma variants commonly require system instructions folded into the user prompt.'],
      },
      {
        provider: 'ollama',
        modelPattern: '*',
        ...OPENAI_COMPATIBLE_DEFAULT,
        supportsJsonMode: false,
        supportsTools: false,
        supportsFunctionCalling: false,
        streamParameter: 'omit',
        notes: ['Local runtimes vary; keep optional OpenAI extensions out unless explicitly supported.'],
      },
      {
        provider: 'lmstudio',
        modelPattern: '*',
        ...OPENAI_COMPATIBLE_DEFAULT,
        supportsJsonMode: false,
        supportsTools: false,
        supportsFunctionCalling: false,
        streamParameter: 'omit',
      },
      {
        provider: 'openai',
        modelPattern: '*',
        ...OPENAI_COMPATIBLE_DEFAULT,
      },
      {
        provider: 'openrouter',
        modelPattern: '*',
        ...OPENAI_COMPATIBLE_DEFAULT,
        notes: ['OpenRouter is model-dependent; provider-specific rules should override this default.'],
      },
      {
        provider: 'groq',
        modelPattern: '*',
        ...OPENAI_COMPATIBLE_DEFAULT,
        supportsJsonMode: false,
      },
      {
        provider: 'together',
        modelPattern: '*',
        ...OPENAI_COMPATIBLE_DEFAULT,
        supportsJsonMode: false,
      },
      {
        provider: 'deepseek',
        modelPattern: '*',
        ...OPENAI_COMPATIBLE_DEFAULT,
      },
      {
        provider: 'glm',
        modelPattern: '*',
        ...OPENAI_COMPATIBLE_DEFAULT,
      },
    ];
  }

  lookup(agent: AgentConfig): CapabilityResolution {
    const provider = this.detectProvider(agent.baseUrl);
    const model = agent.model;

    const matched = this.rules.find(rule =>
      this.providerMatches(rule.provider, provider) &&
      this.modelMatches(rule.modelPattern, model)
    );

    const capabilities: ProviderCapabilities = matched || {
      provider,
      modelPattern: '*',
      ...OPENAI_COMPATIBLE_DEFAULT,
      notes: ['No provider-specific rule matched; using OpenAI-compatible defaults.'],
    };

    return Object.freeze({
      provider,
      model,
      baseUrl: agent.baseUrl,
      matchedRule: `${capabilities.provider}:${capabilities.modelPattern}`,
      capabilities: Object.freeze({ ...capabilities }),
    });
  }

  private detectProvider(baseUrl: string): string {
    const url = baseUrl.toLowerCase();

    if (url.includes('nvidia')) return 'nvidia';
    if (url.includes('openrouter')) return 'openrouter';
    if (url.includes('api.openai.com') || url.includes('openai.azure.com')) return 'openai';
    if (url.includes('groq')) return 'groq';
    if (url.includes('together')) return 'together';
    if (url.includes('deepseek')) return 'deepseek';
    if (url.includes('bigmodel') || url.includes('zhipu') || url.includes('glm')) return 'glm';
    if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('::1')) {
      if (url.includes('11434')) return 'ollama';
      if (url.includes('1234')) return 'lmstudio';
      return 'local';
    }

    return 'custom';
  }

  private providerMatches(ruleProvider: string, provider: string): boolean {
    return ruleProvider === '*' || ruleProvider === provider;
  }

  private modelMatches(pattern: string, model: string): boolean {
    const normalizedPattern = pattern.toLowerCase();
    const normalizedModel = model.toLowerCase();

    if (normalizedPattern === '*') return true;
    if (normalizedPattern.includes('*')) {
      const escaped = normalizedPattern
        .split('*')
        .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*');
      return new RegExp(`^${escaped}$`).test(normalizedModel);
    }

    return normalizedModel.includes(normalizedPattern);
  }
}
