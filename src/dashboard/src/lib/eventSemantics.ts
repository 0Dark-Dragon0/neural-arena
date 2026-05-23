import { RuntimeEvent } from './types';

export type EventSeverity = 'info' | 'success' | 'warning' | 'danger' | 'neutral';
export type EventCategory = 'world' | 'agent' | 'intent' | 'provider' | 'cognition' | 'runtime';

export function getEventCategory(type: string): EventCategory {
  if (type.includes('WORLD') || type.includes('STATE') || type === 'TICK') return 'world';
  if (type.includes('AGENT')) return 'agent';
  if (type.includes('INTENT') || type.includes('ANTICHEAT')) return 'intent';
  if (type.includes('PROVIDER') || type.includes('API_')) return 'provider';
  if (type.includes('COGNITIVE') || type.includes('PROMPT') || type.includes('CONTEXT') || type.includes('FSM')) return 'cognition';
  return 'runtime';
}

export function getEventSeverity(event: RuntimeEvent): EventSeverity {
  const type = event.type;
  if (type.includes('ERROR') || type.includes('REJECTED') || type.includes('VIOLATION') || type.includes('FAIL')) return 'danger';
  if (type.includes('FALLBACK') || type.includes('ESCALATION') || type.includes('PATTERN')) return 'warning';
  if (type.includes('ACCEPTED') || type.includes('PASS') || type.includes('VALIDATED')) return 'success';
  if (type === 'TICK') return 'neutral';
  return 'info';
}

export function formatEventTitle(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function summarizeEvent(event: RuntimeEvent): string {
  const data = event.data || {};
  if (typeof data.message === 'string') return data.message;
  if (typeof data.reason === 'string') return data.reason;
  if (typeof data.action === 'string') return `Action ${data.action}`;
  if (typeof data.strategyId === 'string') return `Strategy ${data.strategyId}`;
  if (typeof data.nodeId === 'string') return `Node ${data.nodeId}`;
  if (typeof data.provider === 'string') return `${data.provider} ${data.model || ''}`.trim();
  return formatEventTitle(event.type);
}

export function severityClass(severity: EventSeverity): string {
  switch (severity) {
    case 'success':
      return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100';
    case 'warning':
      return 'border-amber-300/30 bg-amber-300/10 text-amber-100';
    case 'danger':
      return 'border-rose-300/30 bg-rose-300/10 text-rose-100';
    case 'neutral':
      return 'border-slate-500/20 bg-white/[0.035] text-slate-300';
    default:
      return 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100';
  }
}

export function severityClassLight(severity: EventSeverity): string {
  switch (severity) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'danger':
      return 'border-rose-200 bg-rose-50 text-rose-900';
    case 'neutral':
      return 'border-slate-200 bg-slate-50 text-slate-600';
    default:
      return 'border-blue-200 bg-blue-50 text-blue-900';
  }
}
