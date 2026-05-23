import React, { useMemo } from 'react';
import { useDashboardStore } from '../state/useDashboardStore';
import { useReplayStore } from '../state/useReplayStore';
import { RuntimeEvent } from '../lib/types';
import { 
  BookOpen, 
  Sword, 
  Cpu, 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle2, 
  ChevronRight,
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface StoryItem {
  id: string;
  type: 'opening' | 'capture' | 'thinking' | 'retry' | 'conclusion' | 'general';
  title: string;
  description: string;
  tick: number;
  icon: 'opening' | 'capture' | 'thinking' | 'alert' | 'check' | 'conclusion' | 'general';
  timestamp: string;
}

export const ReplayStoryteller: React.FC = React.memo(() => {
  const liveEvents = useDashboardStore((s) => s.events);
  const isReplayMode = useReplayStore((s) => s.isReplayMode);
  const replayLog = useReplayStore((s) => s.replayLog);
  const seekToTick = useReplayStore((s) => s.seekToTick);
  const currentCursor = useReplayStore((s) => s.cursor);
  const currentTick = useReplayStore((s) => {
    const event = s.replayLog[s.cursor];
    return event ? event.tick : 0;
  });

  const getPieceName = (p: string) => {
    const names: Record<string, string> = {
      p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King',
      P: 'Pawn', N: 'Knight', B: 'Bishop', R: 'Rook', Q: 'Queen', K: 'King'
    };
    return names[p] || 'Piece';
  };

  const storyItems = useMemo<StoryItem[]>(() => {
    const list = isReplayMode ? replayLog : [...liveEvents].reverse();
    if (list.length === 0) return [];

    const items: StoryItem[] = [];
    let prevFen = '';
    let lastThinkingEvent: RuntimeEvent | null = null;
    let attemptCount = 1;
    const movesList: string[] = [];

    const countPieces = (fen: string) => {
      const board = fen.split(' ')[0];
      const counts: Record<string, number> = {
        p: 0, r: 0, n: 0, b: 0, q: 0, k: 0,
        P: 0, R: 0, N: 0, B: 0, Q: 0, K: 0
      };
      for (const char of board) {
        if (counts[char] !== undefined) {
          counts[char]++;
        }
      }
      return counts;
    };

    for (let i = 0; i < list.length; i++) {
      const event = list[i];

      if (event.type === 'AGENT_THINKING') {
        lastThinkingEvent = event;
      }

      if (event.type === 'INTENT_REJECTED' || event.type === 'ANTICHEAT_FAIL') {
        const agentName = event.data.agentIndex === 0 ? 'Alpha (White)' : 'Beta (Black)';
        const action = event.data.action || event.data.parsedAction || 'Unknown';
        const reason = event.data.reason || 'Legality validation failed';
        items.push({
          id: event.eventId,
          type: 'retry',
          title: `Validation Failure — ${agentName}`,
          description: `Attempted move "${action}" was rejected: ${reason}. Triggering cognition pipeline correction loop.`,
          tick: event.tick,
          icon: 'alert',
          timestamp: new Date(event.wallTimestampMs).toLocaleTimeString(),
        });
        attemptCount++;
      }

      if (event.type === 'INTENT_ACCEPTED') {
        const agentIndex = event.data.agentIndex;
        const agentName = agentIndex === 0 ? 'Alpha (White)' : 'Beta (Black)';
        const action = (event.data.action as string) || '';
        movesList.push(action);

        // Detect Opening (first 4 moves / plies)
        if (movesList.length <= 4) {
          let openingName = '';
          let openingDesc = '';
          const m1 = movesList[0];
          const m2 = movesList[1];

          if (movesList.length === 1 && (m1 === 'e4' || m1 === 'e2e4')) {
            openingName = "King's Pawn Opening";
            openingDesc = "White strikes the center and releases lines for the Queen and Bishop.";
          } else if (movesList.length === 1 && (m1 === 'd4' || m1 === 'd2d4')) {
            openingName = "Queen's Pawn Opening";
            openingDesc = "White claims a central foothold and prepares solid positional layouts.";
          } else if (movesList.length === 2 && (m1 === 'e4' || m1 === 'e2e4') && (m2 === 'e5' || m2 === 'e7e5')) {
            openingName = "Open Game (1... e5)";
            openingDesc = "Classic symmetrical response. Both sides vie for central dominance.";
          } else if (movesList.length === 2 && (m1 === 'e4' || m1 === 'e2e4') && (m2 === 'c5' || m2 === 'e7c5')) {
            openingName = "Sicilian Defense";
            openingDesc = "Black responds asymmetricially, striving for tactical counterplay.";
          } else if (movesList.length === 4 && m1 === 'e4' && m2 === 'd6' && movesList[2] === 'Nf3' && movesList[3] === 'Bg4') {
            openingName = "Philidor Defense: Pin Variation";
            openingDesc = "Black pins White's knight to challenge center control.";
          }

          if (openingName) {
            items.push({
              id: `${event.eventId}-opening`,
              type: 'opening',
              title: openingName,
              description: openingDesc,
              tick: event.tick,
              icon: 'opening',
              timestamp: new Date(event.wallTimestampMs).toLocaleTimeString(),
            });
          }
        }

        // Detect high latency thinking
        if (lastThinkingEvent) {
          const thinkTimeMs = event.simulationTimeMs - lastThinkingEvent.simulationTimeMs;
          const isHighLatency = thinkTimeMs > 2000;
          if (isHighLatency) {
            items.push({
              id: `${event.eventId}-think`,
              type: 'thinking',
              title: `${agentName} spent ${(thinkTimeMs / 1000).toFixed(1)}s thinking`,
              description: `Deep positional check of candidate moves. Compiled multiple strategies before selecting "${action}".`,
              tick: event.tick,
              icon: 'thinking',
              timestamp: new Date(event.wallTimestampMs).toLocaleTimeString(),
            });
          }
          lastThinkingEvent = null;
        }

        // Detect if this accepted move was a recovery
        if (attemptCount > 1) {
          items.push({
            id: `${event.eventId}-recovery`,
            type: 'retry',
            title: `Self-Correction — ${agentName}`,
            description: `Successfully resolved previous rejection and submitted valid move "${action}" (after ${attemptCount} attempts).`,
            tick: event.tick,
            icon: 'check',
            timestamp: new Date(event.wallTimestampMs).toLocaleTimeString(),
          });
          attemptCount = 1;
        }
      }

      if (event.type === 'WORLD_STATE_UPDATED') {
        const data = event.data as any;
        const currentFen = data.state || data.fen;
        const turnNumber = data.turnNumber;

        if (prevFen && currentFen) {
          const prevCounts = countPieces(prevFen);
          const currentCounts = countPieces(currentFen);
          const activeAgent = turnNumber % 2 === 0 ? 'Alpha (White)' : 'Beta (Black)';

          let capturedPiece = '';
          let captureColor = '';
          for (const key of Object.keys(prevCounts)) {
            if (currentCounts[key] < prevCounts[key]) {
              capturedPiece = getPieceName(key);
              captureColor = key === key.toLowerCase() ? 'Black' : 'White';
              break;
            }
          }

          if (capturedPiece) {
            items.push({
              id: `${event.eventId}-capture`,
              type: 'capture',
              title: `Turning Point — ${capturedPiece} Captured`,
              description: `${activeAgent} captured ${captureColor}'s ${capturedPiece} during this turn. Position balances shift.`,
              tick: event.tick,
              icon: 'capture',
              timestamp: new Date(event.wallTimestampMs).toLocaleTimeString(),
            });
          }
        }
        prevFen = currentFen;
      }

      if (event.type === 'SIMULATION_STOPPED') {
        const result = event.data.result || 'finished';
        let conclusionText = 'The simulation has ended.';
        if (result === 'checkmate') {
          conclusionText = 'Stunning Checkmate! One side completely outmaneuvered the opponent to seal the game.';
        } else if (result === 'stalemate') {
          conclusionText = 'Stalemate reached. A defensive blockade prevents any further moves.';
        } else if (result === 'draw') {
          conclusionText = 'Draw declared. Players split the point due to agreement or insufficient material.';
        }

        items.push({
          id: event.eventId,
          type: 'conclusion',
          title: `Match Conclusion`,
          description: conclusionText,
          tick: event.tick,
          icon: 'conclusion',
          timestamp: new Date(event.wallTimestampMs).toLocaleTimeString(),
        });
      }
    }

    return items;
  }, [isReplayMode, replayLog, liveEvents]);

  const renderIcon = (iconType: string) => {
    const baseClass = "h-4 w-4";
    switch (iconType) {
      case 'opening':
        return <BookOpen className={`${baseClass} text-sky-400`} />;
      case 'capture':
        return <Sword className={`${baseClass} text-rose-400`} />;
      case 'thinking':
        return <Cpu className={`${baseClass} text-purple-400`} />;
      case 'alert':
        return <AlertTriangle className={`${baseClass} text-amber-500`} />;
      case 'check':
        return <CheckCircle2 className={`${baseClass} text-emerald-400`} />;
      case 'conclusion':
        return <Sparkles className={`${baseClass} text-yellow-400`} />;
      default:
        return <TrendingUp className={`${baseClass} text-muted-foreground`} />;
    }
  };

  const getBorderColor = (type: string, isActive: boolean) => {
    if (isActive) return 'border-primary/80 bg-primary/10 shadow-[0_0_12px_rgba(var(--primary-rgb),0.2)]';
    switch (type) {
      case 'opening': return 'border-sky-500/20 hover:border-sky-500/40 bg-sky-950/5';
      case 'capture': return 'border-rose-500/20 hover:border-rose-500/40 bg-rose-950/5';
      case 'thinking': return 'border-purple-500/20 hover:border-purple-500/40 bg-purple-950/5';
      case 'retry': return 'border-amber-500/20 hover:border-amber-500/40 bg-amber-950/5';
      case 'conclusion': return 'border-yellow-500/30 hover:border-yellow-500/50 bg-yellow-950/10';
      default: return 'border-border/40 hover:border-border/60 bg-muted/5';
    }
  };

  if (storyItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center h-full">
        <div className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center border border-border/50 mb-3">
          <BookOpen className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <h4 className="text-xs font-semibold text-foreground mb-1">Chronicle Empty</h4>
        <p className="text-3xs text-muted-foreground max-w-[240px]">
          No story beats have been generated. Start a match or play a replay to populate the timeline.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-muted/10">
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider font-telemetry">Story Chronicle</h3>
        </div>
        <span className="text-3xs font-telemetry text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/20">
          {storyItems.length} beats
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {storyItems.map((item) => {
          const isActive = isReplayMode && currentTick >= item.tick && currentTick < item.tick + 10;
          return (
            <div
              key={item.id}
              onClick={() => isReplayMode && seekToTick(item.tick)}
              className={`group flex items-start gap-3 p-3 rounded-lg border text-left transition-all duration-300 ${
                isReplayMode ? 'cursor-pointer' : ''
              } ${getBorderColor(item.type, isActive)}`}
            >
              <div className="mt-0.5 p-1.5 rounded bg-muted/40 border border-border/20">
                {renderIcon(item.icon)}
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-2xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {item.title}
                  </h4>
                  <span className="text-3xs font-telemetry text-muted-foreground/60 whitespace-nowrap">
                    {item.timestamp}
                  </span>
                </div>
                <p className="text-3xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
                {isReplayMode && (
                  <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-4xs font-telemetry text-primary uppercase">Jump to Tick</span>
                    <ChevronRight className="h-2 w-2 text-primary" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

ReplayStoryteller.displayName = 'ReplayStoryteller';
