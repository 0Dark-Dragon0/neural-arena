// ================================================================
// Neural Arena — Agent Manager
// ================================================================
// Manages agent configurations. Agents are untrusted AI models.
// API keys are stored in memory ONLY — never logged, never persisted.
// ================================================================

import { AgentConfig } from './types';

export class AgentManager {
  private agents: AgentConfig[] = [];

  /** Register a new agent. Returns the complete config with assigned index. */
  addAgent(config: Omit<AgentConfig, 'index'>): AgentConfig {
    const agent: AgentConfig = {
      ...config,
      index: this.agents.length,
    };
    this.agents.push(agent);
    return agent;
  }

  /** Get agent config by index. Throws if out of bounds. */
  getAgent(index: number): AgentConfig {
    if (index < 0 || index >= this.agents.length) {
      throw new Error(`Agent index ${index} out of bounds (have ${this.agents.length} agents)`);
    }
    return this.agents[index];
  }

  /** Get all registered agents */
  getAllAgents(): AgentConfig[] {
    return [...this.agents];
  }

  /** Get agent count */
  getAgentCount(): number {
    return this.agents.length;
  }

  /** Get display-safe info (no API keys) */
  getAgentDisplayName(index: number): string {
    const agent = this.getAgent(index);
    return agent.name || agent.model;
  }
}
