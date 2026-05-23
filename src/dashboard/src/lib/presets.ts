/**
 * Runtime Presets — Pre-configured simulation profiles.
 * 
 * Each preset provides sensible defaults for different use cases.
 * Domain-agnostic — these configure orchestration behavior, not game rules.
 */

export interface RuntimePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: {
    timeoutMs: number;
    maxRetries?: number;
    tickDelayMs?: number;
  };
}

export const RUNTIME_PRESETS: RuntimePreset[] = [
  {
    id: 'rapid',
    name: 'Rapid Benchmark',
    description: 'Fast-paced evaluation. Short timeouts, speed-optimized cognition.',
    icon: '⚡',
    config: {
      timeoutMs: 30000,
      maxRetries: 2,
      tickDelayMs: 100,
    },
  },
  {
    id: 'balanced',
    name: 'Balanced Analysis',
    description: 'Standard simulation. Balanced timeouts, full cognition pipeline.',
    icon: '⚖️',
    config: {
      timeoutMs: 120000,
      maxRetries: 5,
      tickDelayMs: 250,
    },
  },
  {
    id: 'deep',
    name: 'Deep Analysis',
    description: 'Extended cognition window. High timeouts, thorough evaluation.',
    icon: '🔬',
    config: {
      timeoutMs: 300000,
      maxRetries: 10,
      tickDelayMs: 500,
    },
  },
  {
    id: 'endurance',
    name: 'Endurance Test',
    description: 'Stress test. Extended match, high retry tolerance, reliability focus.',
    icon: '🏋️',
    config: {
      timeoutMs: 600000,
      maxRetries: 15,
      tickDelayMs: 250,
    },
  },
  {
    id: 'demo',
    name: 'Quick Demo',
    description: 'Demonstration mode. Fast results, minimal configuration.',
    icon: '🎬',
    config: {
      timeoutMs: 60000,
      maxRetries: 3,
      tickDelayMs: 150,
    },
  },
];

export function getPreset(id: string): RuntimePreset | undefined {
  return RUNTIME_PRESETS.find(p => p.id === id);
}

export function getDefaultPreset(): RuntimePreset {
  return RUNTIME_PRESETS.find(p => p.id === 'balanced')!;
}
