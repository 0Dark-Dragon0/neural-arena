import React, { useMemo } from 'react';
import { useDashboardStore } from '../state/useDashboardStore';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

interface LegendItem {
  key: string;
  label: string;
  color: string;
}

const LEGEND: LegendItem[] = [
  { key: 'eventRate', label: 'Events', color: 'hsl(220, 13%, 69%)' },
  { key: 'cognitionEvents', label: 'Cognition', color: 'hsl(234, 62%, 56%)' },
  { key: 'errorEvents', label: 'Errors', color: 'hsl(0, 72%, 60%)' },
];

export const TelemetryChart: React.FC = React.memo(() => {
  const samples = useDashboardStore((s) => s.telemetrySamples);

  const data = useMemo(() => {
    return samples.map(s => ({
      tick: s.tick,
      eventRate: s.eventRate,
      cognitionEvents: s.cognitionEvents,
      errorEvents: s.errorEvents,
    }));
  }, [samples]);

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telemetry</h3>
        <div className="flex items-center gap-3">
          {LEGEND.map(item => (
            <div key={item.key} className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
              <span className="text-3xs text-muted-foreground/60">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="h-[120px] w-full">
        {data.length < 2 ? (
          <div className="flex items-center justify-center h-full text-2xs text-muted-foreground/40 border border-border/30 rounded-xl">
            Collecting samples...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradEvents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(220, 13%, 69%)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(220, 13%, 69%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCognition" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(234, 62%, 56%)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(234, 62%, 56%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradErrors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(0, 72%, 60%)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(0, 72%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="tick" tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
                tick={{ fontSize: 9, fill: 'hsl(220, 9%, 46%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(220, 9%, 46%)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'hsl(0, 0%, 100%)', border: '1px solid hsl(220, 13%, 91%)', borderRadius: 8, fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', padding: '8px 12px' }}
                labelFormatter={(v: number) => `Tick ${v.toLocaleString()}`} />
              <Area type="monotone" dataKey="eventRate" stroke="hsl(220, 13%, 69%)" strokeWidth={1.5} fill="url(#gradEvents)" dot={false} animationDuration={300} />
              <Area type="monotone" dataKey="cognitionEvents" stroke="hsl(234, 62%, 56%)" strokeWidth={1.5} fill="url(#gradCognition)" dot={false} animationDuration={300} />
              <Area type="monotone" dataKey="errorEvents" stroke="hsl(0, 72%, 60%)" strokeWidth={1.5} fill="url(#gradErrors)" dot={false} animationDuration={300} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});
TelemetryChart.displayName = 'TelemetryChart';
