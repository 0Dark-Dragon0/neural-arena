import React from 'react';
import { useDashboardStore } from '../state/useDashboardStore';
import { Badge } from '../components/ui/Badge';

export const EngineStatusPanel: React.FC = () => {
  const connectionStatus = useDashboardStore((s) => s.connectionStatus);
  const simulationState = useDashboardStore((s) => s.simulationState);
  const tick = useDashboardStore((s) => s.world.tick);
  const simulationTimeMs = useDashboardStore((s) => s.world.simulationTimeMs);

  const formatUptime = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    return `${String(hrs).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Engine Status</h3>
        <Badge
          variant={connectionStatus === 'live' ? 'success' : 'error'}
          dot
          pulse={connectionStatus === 'live'}
        >
          {connectionStatus === 'live' ? 'ONLINE' : 'OFFLINE'}
        </Badge>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Uptime</span>
          <span className="font-telemetry font-semibold text-foreground">{formatUptime(simulationTimeMs)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Ticks / Sec</span>
          <span className="font-telemetry font-semibold text-foreground">
            {tick > 0 && simulationTimeMs > 0 ? (tick / (simulationTimeMs / 1000)).toFixed(1) : '0.0'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Current Tick</span>
          <span className="font-telemetry font-semibold text-foreground">{tick.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
