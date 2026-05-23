// ================================================================
// Neural Arena - Deterministic ID Helpers
// ================================================================
// Runtime-local monotonic identifiers. These are replay-safe as long
// as creation order is deterministic.
// ================================================================

export function formatDeterministicId(prefix: string, sequence: number): string {
  return `${prefix}-${sequence.toString().padStart(6, '0')}`;
}

export function parseDeterministicSequence(id: unknown, prefix: string): number | null {
  if (typeof id !== 'string') return null;
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(id);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}
