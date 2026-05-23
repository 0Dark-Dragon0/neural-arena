/**
 * RuntimeDiagnostics — Compact diagnostics panel showing key runtime health metrics.
 * Extracted from event stream analysis — token throughput proxy, error rate, etc.
 */
import React, { useMemo } from 'react';
import { useDashboardStore } from '../state/useDashboardStore';
import { useRuntimePulse } from '../hooks/useRuntimePulse';
import { Badge } from '../components/ui/Badge';

export const RuntimeDiagnostics: React.FC = () => {
  const events = useDashboardStore((s) => s.events);
  const world = useDashboardStore((s) => s.world);
  const agents = useDashboardStore((s) => s.agents);
  const pulse = useRuntimePulse();

  const stats = useMemo(() => {
    const recent50 = events.slice(0, 50);
    
    // Count event types in recent window
    let providerEvents = 0;
    let escalations = 0;
    let corrections = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    for (const ev of recent50) {
      if (ev.type.includes('PROVIDER')) providerEvents++;
      if (ev.type.includes('ESCALATION')) escalations++;
      if (ev.type.includes('CORRECTION') || ev.type.includes('NORMALIZATION')) corrections++;
      if (ev.data && typeof ev.data.latencyMs === 'number') {
        totalLatency += ev.data.latencyMs as number;
        latencyCount++;
      }
    }

    const avgLatency = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null;
    const stateHash = world.stateHash || '—';

    return { providerEvents, escalations, corrections, avgLatency, stateHash };
  }, [events, world.stateHash]);

  const agent0 = agents[0];
  const agent1 = agents[1];

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Agent Lifecycle States */}
      <div>
        <h4 className="text-2xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">Agent Lifecycle</h4>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Alpha (White)</span>
            <Badge variant={agent0?.lifecycle === 'THINKING' ? 'thinking' : agent0?.lifecycle === 'ACCEPTED' ? 'success' : 'muted'} dot>
              {agent0?.lifecycle || 'IDLE'}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Beta (Black)</span>
            <Badge variant={agent1?.lifecycle === 'THINKING' ? 'thinking' : agent1?.lifecycle === 'ACCEPTED' ? 'success' : 'muted'} dot>
              {agent1?.lifecycle || 'IDLE'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Runtime Health */}
      <div>
        <h4 className="text-2xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">Runtime Health</h4>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Cognition Heat</span>
            <div className="flex items-center gap-2">
              <div className="h-1 w-10 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary/60 transition-all duration-500" style={{ width: `${pulse.cognitionHeat * 100}%` }} />
              </div>
              <span className="font-telemetry font-semibold text-foreground w-8 text-right">{(pulse.cognitionHeat * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Error Pressure</span>
            <div className="flex items-center gap-2">
              <div className="h-1 w-10 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{
                  width: `${pulse.errorPressure * 100}%`,
                  background: pulse.errorPressure > 0.5 ? 'hsl(0, 72%, 60%)' : 'hsl(38, 92%, 50%)',
                }} />
              </div>
              <span className="font-telemetry font-semibold text-foreground w-8 text-right">{(pulse.errorPressure * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Escalations</span>
            <span className="font-telemetry font-semibold text-foreground">{stats.escalations}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Corrections</span>
            <span className="font-telemetry font-semibold text-foreground">{stats.corrections}</span>
          </div>
          {stats.avgLatency !== null && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg Latency</span>
              <span className="font-telemetry font-semibold text-foreground">{stats.avgLatency}ms</span>
            </div>
          )}
        </div>
      </div>

      {/* State Hash */}
      <div>
        <h4 className="text-2xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5">State Hash</h4>
        <div className="font-telemetry text-3xs text-muted-foreground/50 bg-muted/30 rounded-lg px-2 py-1.5 truncate border border-border/30">
          {stats.stateHash}
        </div>
      </div>
    </div>
  );
};
