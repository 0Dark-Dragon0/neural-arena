// ================================================================
// Neural Arena - Prompt Compiler
// ================================================================
// Converts simulation prompts into provider-neutral abstract prompts.
// Provider-specific roles and payload shape are handled downstream.
// ================================================================

import { PromptPair } from '../core/types';
import { AbstractPrompt } from './ProviderAdapter';

export class PromptCompiler {
  compile(prompt: PromptPair, metadata: Record<string, unknown> = {}): AbstractPrompt {
    return Object.freeze({
      systemInstructions: prompt.systemPrompt,
      userInstructions: prompt.userPrompt,
      metadata: Object.freeze({ ...metadata }),
      expectedOutput: Object.freeze({
        type: 'json_object',
        enforceWithProvider: false,
      }),
    });
  }
}
