// ================================================================
// Neural Arena — API Worker
// ================================================================
// Executes asynchronous provider requests without blocking the
// simulation tick loop.
// ================================================================

import { AgentConfig, PromptPair } from '../core/types';
import { ApiClient } from '../core/api-client';
import { ApiCallContext } from './ProviderAdapter';

export class APIWorker {
  private apiClient: ApiClient;

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  async executeTask(agent: AgentConfig, prompt: PromptPair, context: ApiCallContext = {}): Promise<any> {
    try {
      const response = await this.apiClient.call(agent, prompt, context);
      return response;
    } catch (error) {
      throw error;
    }
  }
}
