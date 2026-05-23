import React, { useRef, useEffect } from 'react';
import { useDashboardStore } from '../state/useDashboardStore';

export const MoveHistory: React.FC = React.memo(() => {
  const moves = useDashboardStore((s) => s.moves);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [moves.length]);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Move History</h3>
        <span className="text-2xs font-telemetry text-muted-foreground/50">{moves.length} turns</span>
      </div>

      <div className="flex items-center text-2xs font-semibold text-muted-foreground/50 uppercase tracking-wider pb-2 border-b border-border/30 shrink-0">
        <span className="w-8 text-center">#</span>
        <span className="flex-1 pl-3">White</span>
        <span className="flex-1 pl-3">Black</span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        {moves.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground/40">
            Awaiting moves...
          </div>
        ) : (
          moves.map((move) => (
            <div key={move.turnNumber} className="flex items-center text-xs py-1.5 hover:bg-muted/30 transition-colors duration-100 rounded">
              <span className="w-8 text-center font-telemetry text-2xs text-muted-foreground/50">{move.turnNumber}.</span>
              <span className={`flex-1 pl-3 font-telemetry font-semibold ${move.whiteMove ? 'text-foreground' : 'text-muted-foreground/30'}`}>
                {move.whiteMove || '...'}
              </span>
              <span className={`flex-1 pl-3 font-telemetry font-semibold ${move.blackMove ? 'text-foreground' : 'text-muted-foreground/30'}`}>
                {move.blackMove || '...'}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
});
MoveHistory.displayName = 'MoveHistory';
