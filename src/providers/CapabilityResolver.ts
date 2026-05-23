// ================================================================
// Neural Arena - Capability Resolver
// ================================================================
// Thin orchestration layer around the registry. Kept separate so
// later provider probing or cached compatibility manifests can plug in.
// ================================================================

import { AgentConfig } from '../core/types';
import { CapabilityResolution } from './ProviderAdapter';
import { ProviderCapabilityRegistry } from './ProviderCapabilityRegistry';

export class CapabilityResolver {
  private readonly registry: ProviderCapabilityRegistry;

  constructor(registry: ProviderCapabilityRegistry = new ProviderCapabilityRegistry()) {
    this.registry = registry;
  }

  resolve(agent: AgentConfig): CapabilityResolution {
    return this.registry.lookup(agent);
  }
}
