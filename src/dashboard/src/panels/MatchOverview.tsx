import React, { useMemo } from 'react';
import { useDashboardStore } from '../state/useDashboardStore';
import { Badge } from '../components/ui/Badge';
import { Chess } from 'chess.js';

export const MatchOverview: React.FC = React.memo(() => {
  const simulationState = useDashboardStore((s) => s.simulationState);
  const tick = useDashboardStore((s) => s.world.tick);
  const turnNumber = useDashboardStore((s) => s.world.turnNumber);
  const fen = useDashboardStore((s) => s.world.fen);
  const moveCount = useDashboardStore((s) => s.moves.length);

  // Game-over detection using chess.js
  const gameStatus = useMemo(() => {
    if (!fen) return null;
    try {
      const chess = new Chess(fen);
      if (chess.isCheckmate()) return { label: 'Checkmate', variant: 'error' as const };
      if (chess.isStalemate()) return { label: 'Stalemate', variant: 'warning' as const };
      if (chess.isDraw()) return { label: 'Draw', variant: 'warning' as const };
      if (chess.isCheck()) return { label: 'Check', variant: 'warning' as const };
      return null;
    } catch {
      return null;
    }
  }, [fen]);

  const statusVariant = simulationState === 'running' ? 'success'
    : simulationState === 'paused' ? 'warning'
    : simulationState === 'stopped' ? 'error'
    : 'muted';

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Match Overview</h3>
      </div>

      {/* Agents VS */}
      <div className="flex items-center justify-center gap-3 py-3">
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-lg">♘</div>
          <span className="text-2xs font-semibold text-foreground">Alpha</span>
          <span className="text-3xs text-muted-foreground">(White)</span>
        </div>
        <span className="text-xs font-bold text-muted-foreground/40 tracking-widest">VS</span>
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-lg text-background">♞</div>
          <span className="text-2xs font-semibold text-foreground">Beta</span>
          <span className="text-3xs text-muted-foreground">(Black)</span>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Status</span>
          <Badge variant={statusVariant} dot pulse={simulationState === 'running'}>
            {simulationState.toUpperCase()}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Move Count</span>
          <span className="font-semibold font-telemetry text-foreground">{moveCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Current Tick</span>
          <span className="font-semibold font-telemetry text-foreground">{tick.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Game State</span>
          {gameStatus ? (
            <Badge variant={gameStatus.variant} dot>{gameStatus.label}</Badge>
          ) : (
            <span className="font-medium text-muted-foreground/60">In Progress</span>
          )}
        </div>
      </div>
    </div>
  );
});
MatchOverview.displayName = 'MatchOverview';
