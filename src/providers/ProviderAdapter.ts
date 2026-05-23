// ================================================================
// Neural Arena - Provider Adapter Contracts
// ================================================================
// Provider compatibility is handled outside simulation logic. The
// simulation produces abstract prompts; adapters compile requests.
// ================================================================

import { AgentConfig, SimulationConfig } from '../core/types';

export type ProviderApiFormat = 'openai-chat-completions';
export type StreamParameterPolicy = 'include_false' | 'omit';

export interface ProviderCapabilities {
  readonly provider: string;
  readonly modelPattern: string;
  readonly supportsSystemRole: boolean;
  readonly supportsStreaming: boolean;
  readonly supportsJsonMode: boolean;
  readonly supportsTools: boolean;
  readonly supportsVision: boolean;
  readonly supportsMultiTurn: boolean;
  readonly supportsFunctionCalling: boolean;
  readonly apiFormat: ProviderApiFormat;
  readonly streamParameter: StreamParameterPolicy;
  readonly notes?: readonly string[];
}

export interface CapabilityResolution {
  readonly provider: string;
  readonly model: string;
  readonly baseUrl: string;
  readonly matchedRule: string;
  readonly capabilities: ProviderCapabilities;
}

export interface ExpectedOutputSpec {
  readonly type: 'json_object' | 'text';
  readonly enforceWithProvider: boolean;
  readonly schema?: Readonly<Record<string, unknown>>;
}

export interface AbstractPrompt {
  readonly systemInstructions: string;
  readonly userInstructions: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly expectedOutput: ExpectedOutputSpec;
}

export interface ProviderMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
}

export interface ProviderRequestBody {
  model: string;
  messages: ProviderMessage[];
  max_tokens: number;
  temperature: number;
  stream?: boolean;
  response_format?: { type: 'json_object' };
  tools?: unknown[];
}

export type CompatibilityDecisionType =
  | 'CAPABILITY_LOOKUP'
  | 'PROVIDER_ADAPTATION'
  | 'PROMPT_TRANSFORMED'
  | 'FALLBACK_ACTIVATED'
  | 'UNSUPPORTED_FEATURE_HANDLED'
  | 'COMPATIBILITY_DECISION';

export interface CompatibilityDecision {
  readonly type: CompatibilityDecisionType;
  readonly code: string;
  readonly message: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface ProviderRequest {
  readonly adapterName: string;
  readonly resolution: CapabilityResolution;
  readonly body: ProviderRequestBody;
  readonly decisions: readonly CompatibilityDecision[];
}

export interface ProviderAdapter {
  readonly name: string;

  buildRequest(
    agent: AgentConfig,
    prompt: AbstractPrompt,
    config: SimulationConfig,
    resolution: CapabilityResolution,
  ): ProviderRequest;
}

export interface ApiCallContext {
  readonly agentIndex?: number;
  readonly requestId?: string;
  readonly sourceEventId?: string;
  readonly turnNumber?: number;
  readonly stateNodeId?: string;
  readonly stateHash?: string;
}

export interface ProviderCompatibilityTraceEvent {
  readonly type: CompatibilityDecisionType;
  readonly code: string;
  readonly message: string;
  readonly provider: string;
  readonly model: string;
  readonly requestId?: string;
  readonly sourceEventId?: string;
  readonly agentIndex?: number;
  readonly turnNumber?: number;
  readonly stateNodeId?: string;
  readonly stateHash?: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export type ProviderCompatibilityObserver = (event: ProviderCompatibilityTraceEvent) => void;
