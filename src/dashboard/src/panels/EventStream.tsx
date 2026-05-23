import React, { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDashboardStore } from '../state/useDashboardStore';
import { getEventSeverity, getEventCategory, summarizeEvent } from '../lib/eventSemantics';
import { Badge } from '../components/ui/Badge';

const severityToDot: Record<string, string> = {
  info: 'bg-blue-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-rose-400',
  neutral: 'bg-muted-foreground/30',
};

type FilterOption = 'all' | 'world' | 'cognition' | 'intent' | 'provider' | 'errors';

const FILTERS: { key: FilterOption; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'world', label: 'World' },
  { key: 'cognition', label: 'Cognition' },
  { key: 'intent', label: 'Intents' },
  { key: 'errors', label: 'Errors' },
];

export const EventStream: React.FC = React.memo(() => {
  const events = useDashboardStore((s) => s.events);
  const [filter, setFilter] = useState<FilterOption>('all');
  const parentRef = useRef<HTMLDivElement>(null);

  const filteredEvents = useMemo(() => {
    const slice = events.slice(0, 500);
    if (filter === 'all') return slice;
    if (filter === 'errors') return slice.filter(ev => {
      const sev = getEventSeverity(ev);
      return sev === 'danger' || sev === 'warning';
    });
    return slice.filter(ev => getEventCategory(ev.type) === filter);
  }, [events, filter]);

  const virtualizer = useVirtualizer({
    count: filteredEvents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  return (
    <div className="flex h-full flex-col animate-fade-in">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between shrink-0">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Event Log</h3>
        <Badge variant="info" dot pulse>Live</Badge>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-0.5 mb-2 shrink-0 bg-muted/40 rounded-lg p-0.5">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2 py-1 rounded-md text-3xs font-semibold transition-all duration-200 ${
              filter === f.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground/60 hover:text-muted-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Virtualized Event List */}
      <div ref={parentRef} className="flex-1 overflow-y-auto min-h-0 pr-1">
        {filteredEvents.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-2xs text-muted-foreground/40">
            No events match this filter
          </div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map(virtualRow => {
              const ev = filteredEvents[virtualRow.index];
              const severity = getEventSeverity(ev);
              const summary = summarizeEvent(ev);
              const dotClass = severityToDot[severity] || severityToDot.neutral;

              return (
                <div
                  key={ev.eventId}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="flex items-start gap-2.5 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors duration-100"
                >
                  <div className="pt-1.5 shrink-0">
                    <div className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-2xs">
                      <span className="font-telemetry text-muted-foreground/50">{ev.tick.toLocaleString()}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="text-muted-foreground/50 truncate font-telemetry">{ev.type.replace(/_/g, ' ').toLowerCase()}</span>
                    </div>
                    <div className="text-xs text-foreground/80 leading-snug mt-0.5 truncate">
                      {summary}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
EventStream.displayName = 'EventStream';
