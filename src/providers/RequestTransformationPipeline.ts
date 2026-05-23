// ================================================================
// Neural Arena - Request Transformation Pipeline
// ================================================================
// Deterministically adapts abstract prompts to provider-compatible
// request payloads using resolved model capabilities.
// ================================================================

import { AgentConfig, SimulationConfig } from '../core/types';
import { CapabilityResolver } from './CapabilityResolver';
import {
  AbstractPrompt,
  CapabilityResolution,
  CompatibilityDecision,
  ProviderAdapter,
  ProviderMessage,
  ProviderRequest,
  ProviderRequestBody,
} from './ProviderAdapter';

export class RequestTransformationPipeline {
  private readonly resolver: CapabilityResolver;
  private readonly adapter: ProviderAdapter;

  constructor(
    resolver: CapabilityResolver = new CapabilityResolver(),
    adapter: ProviderAdapter = new OpenAICompatibleProviderAdapter(),
  ) {
    this.resolver = resolver;
    this.adapter = adapter;
  }

  transform(agent: AgentConfig, prompt: AbstractPrompt, config: SimulationConfig): ProviderRequest {
    const resolution = this.resolver.resolve(agent);
    return this.adapter.buildRequest(agent, prompt, config, resolution);
  }
}

class OpenAICompatibleProviderAdapter implements ProviderAdapter {
  readonly name = 'openai-compatible-chat';

  buildRequest(
    agent: AgentConfig,
    prompt: AbstractPrompt,
    config: SimulationConfig,
    resolution: CapabilityResolution,
  ): ProviderRequest {
    const decisions: CompatibilityDecision[] = [
      {
        type: 'CAPABILITY_LOOKUP',
        code: 'capability_rule_matched',
        message: `Resolved provider capabilities using ${resolution.matchedRule}`,
        data: {
          provider: resolution.provider,
          model: resolution.model,
          matchedRule: resolution.matchedRule,
          capabilities: resolution.capabilities,
        },
      },
    ];

    const messages = this.compileMessages(prompt, resolution, decisions);
    const isReasoning = isReasoningModel(agent.model);
    const body: ProviderRequestBody = {
      model: agent.model,
      messages,
      max_tokens: isReasoning ? Math.max(config.maxTokens, 4096) : config.maxTokens,
      temperature: isReasoning ? 1.0 : 0.7,
    };

    if (resolution.capabilities.streamParameter === 'include_false') {
      body.stream = false;
      decisions.push({
        type: 'COMPATIBILITY_DECISION',
        code: 'streaming_disabled',
        message: 'Streaming was not requested; emitting stream:false for OpenAI-compatible transport.',
        data: { stream: false },
      });
    } else {
      decisions.push({
        type: 'UNSUPPORTED_FEATURE_HANDLED',
        code: 'stream_parameter_omitted',
        message: 'Provider rule omits the stream parameter to avoid unsupported transport options.',
        data: { supportsStreaming: resolution.capabilities.supportsStreaming },
      });
    }

    if (prompt.expectedOutput.enforceWithProvider) {
      if (resolution.capabilities.supportsJsonMode) {
        body.response_format = { type: 'json_object' };
        decisions.push({
          type: 'PROVIDER_ADAPTATION',
          code: 'json_mode_enabled',
          message: 'Provider supports JSON mode, so response_format was included.',
          data: { responseFormat: body.response_format },
        });
      } else {
        decisions.push({
          type: 'UNSUPPORTED_FEATURE_HANDLED',
          code: 'json_mode_omitted',
          message: 'Prompt expects JSON, but provider JSON mode is unsupported; prompt-level JSON instructions are preserved.',
          data: { expectedOutput: prompt.expectedOutput.type },
        });
      }
    }

    decisions.push({
      type: 'PROVIDER_ADAPTATION',
      code: 'request_payload_compiled',
      message: 'Compiled provider-compatible request payload.',
      data: {
        adapter: this.name,
        provider: resolution.provider,
        model: resolution.model,
        messageRoles: messages.map(message => message.role),
        messageCount: messages.length,
        hasResponseFormat: Boolean(body.response_format),
        hasTools: Boolean(body.tools),
        hasStreamParameter: Object.prototype.hasOwnProperty.call(body, 'stream'),
      },
    });

    return Object.freeze({
      adapterName: this.name,
      resolution,
      body: Object.freeze({
        ...body,
        messages: messages.map(message => Object.freeze({ ...message })),
      }),
      decisions: decisions.map(decision => Object.freeze({
        ...decision,
        data: Object.freeze({ ...decision.data }),
      })),
    });
  }

  private compileMessages(
    prompt: AbstractPrompt,
    resolution: CapabilityResolution,
    decisions: CompatibilityDecision[],
  ): ProviderMessage[] {
    const capabilities = resolution.capabilities;

    if (!capabilities.supportsMultiTurn) {
      const content = this.flattenSystemAndUser(prompt);
      decisions.push({
        type: 'FALLBACK_ACTIVATED',
        code: 'single_turn_fallback',
        message: 'Provider does not support multi-turn messages; system and user instructions were folded into one user message.',
        data: {
          reason: 'supportsMultiTurn=false',
          messageRoles: ['user'],
          messages: [{ role: 'user', content }],
        },
      });
      decisions.push(this.promptTransformedDecision('multi_turn_flattened', [{ role: 'user', content }]));
      return [Object.freeze({ role: 'user', content })];
    }

    if (!capabilities.supportsSystemRole) {
      const content = this.flattenSystemAndUser(prompt);
      decisions.push({
        type: 'FALLBACK_ACTIVATED',
        code: 'system_role_fallback',
        message: 'Provider does not support role "system"; system instructions were folded into the user message.',
        data: {
          reason: 'supportsSystemRole=false',
          messageRoles: ['user'],
          messages: [{ role: 'user', content }],
        },
      });
      decisions.push(this.promptTransformedDecision('system_role_folded_into_user', [{ role: 'user', content }]));
      return [Object.freeze({ role: 'user', content })];
    }

    const messages: ProviderMessage[] = [
      Object.freeze({ role: 'system', content: prompt.systemInstructions }),
      Object.freeze({ role: 'user', content: prompt.userInstructions }),
    ];

    decisions.push(this.promptTransformedDecision('native_system_user_messages', messages));
    return messages;
  }

  private flattenSystemAndUser(prompt: AbstractPrompt): string {
    return [
      '[SYSTEM INSTRUCTIONS]',
      prompt.systemInstructions,
      '',
      '[USER REQUEST]',
      prompt.userInstructions,
    ].join('\n');
  }

  private promptTransformedDecision(code: string, messages: ProviderMessage[]): CompatibilityDecision {
    return {
      type: 'PROMPT_TRANSFORMED',
      code,
      message: 'Prompt was transformed into provider-compatible chat messages.',
      data: {
        messageRoles: messages.map(message => message.role),
        messageCount: messages.length,
        messages,
      },
    };
  }
}

function isReasoningModel(modelName: string): boolean {
  const name = modelName.toLowerCase();
  return (
    name.includes('r1') ||
    name.includes('reasoner') ||
    name.includes('reasoning') ||
    name.includes('glm-5') ||
    name.includes('glm-6') ||
    name.includes('o1-') ||
    name.includes('o3-mini') ||
    name.includes('o1-preview') ||
    name.includes('o1-mini')
  );
}
