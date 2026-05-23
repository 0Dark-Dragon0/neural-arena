/**
 * ReplayTimeline — Cinematic replay timeline scrubber.
 *
 * Features:
 * - Full-width slider tracking the event cursor position
 * - Move markers along the timeline (WORLD_STATE_UPDATED events)
 * - Current tick and progress display
 * - Smooth dragging with pointer events
 * - Replay mode badge
 */
import React, { useMemo, useCallback, useRef } from 'react';
import { useReplayStore } from '../state/useReplayStore';
import { motion } from 'framer-motion';
import { Badge } from './ui/Badge';

export const ReplayTimeline: React.FC = () => {
  const { cursor, replayLog, totalEvents, minTick, maxTick, isPlaying, seekToCursor } = useReplayStore();
  const trackRef = useRef<HTMLDivElement>(null);

  const currentTick = replayLog[cursor]?.tick ?? 0;
  const progress = totalEvents > 1 ? cursor / (totalEvents - 1) : 0;

  // Compute move marker positions (WORLD_STATE_UPDATED events)
  const moveMarkers = useMemo(() => {
    if (totalEvents < 2) return [];
    const markers: number[] = [];
    for (let i = 0; i < replayLog.length; i++) {
      if (replayLog[i].type === 'WORLD_STATE_UPDATED') {
        markers.push(i / (totalEvents - 1));
      }
    }
    return markers;
  }, [replayLog, totalEvents]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;

    const seek = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const newCursor = Math.round(ratio * (totalEvents - 1));
      seekToCursor(newCursor);
    };

    seek(e.clientX);

    const onMove = (ev: PointerEvent) => seek(ev.clientX);
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [totalEvents, seekToCursor]);

  return (
    <div className="flex flex-col gap-2 w-full px-6 py-3 bg-card border-t border-border/40 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="warning" dot>Replay</Badge>
          <span className="text-2xs text-muted-foreground">
            Event {cursor + 1} / {totalEvents}
          </span>
        </div>
        <div className="flex items-center gap-3 text-2xs text-muted-foreground">
          <span>Tick <span className="font-telemetry font-semibold text-foreground">{currentTick.toLocaleString()}</span></span>
          <span className="text-muted-foreground/30">|</span>
          <span><span className="font-telemetry font-semibold text-foreground">{(progress * 100).toFixed(1)}%</span></span>
        </div>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-6 cursor-pointer group"
        onPointerDown={handlePointerDown}
      >
        {/* Background Track */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 rounded-full bg-muted" />

        {/* Filled Track */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-1 rounded-full bg-primary/50"
          style={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.05 }}
        />

        {/* Move Markers */}
        {moveMarkers.map((pos, i) => (
          <div
            key={i}
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2.5 rounded-full bg-primary/25"
            style={{ left: `${pos * 100}%` }}
          />
        ))}

        {/* Scrubber Head */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-card border-2 border-primary shadow-sm group-hover:scale-110 transition-transform"
          style={{ left: `${progress * 100}%` }}
          transition={{ duration: 0.05 }}
        />
      </div>

      {/* Tick Range */}
      <div className="flex items-center justify-between text-3xs font-telemetry text-muted-foreground/40">
        <span>{minTick.toLocaleString()}</span>
        <span>{maxTick.toLocaleString()}</span>
      </div>
    </div>
  );
};
