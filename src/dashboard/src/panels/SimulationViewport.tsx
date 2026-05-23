import React, { useMemo } from 'react';
import { useDashboardStore } from '../state/useDashboardStore';
import { useRuntimePulse } from '../hooks/useRuntimePulse';
import { motion, AnimatePresence } from 'framer-motion';

const PIECE_MAP: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

const FILES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export const SimulationViewport: React.FC = () => {
  const fen = useDashboardStore((s) => s.world.fen) || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const turn = useDashboardStore((s) => s.world.turnNumber);
  const pulse = useRuntimePulse();

  const board = useMemo(() => {
    const rows = fen.split(' ')[0].split('/');
    const cells: { row: number; col: number; piece: string; key: string }[] = [];
    for (let r = 0; r < 8; r++) {
      let c = 0;
      for (const char of rows[r]) {
        if (!isNaN(parseInt(char))) {
          for (let i = 0; i < parseInt(char); i++) {
            cells.push({ row: r, col: c, piece: '', key: `${r}-${c}` });
            c++;
          }
        } else {
          cells.push({ row: r, col: c, piece: char, key: `${r}-${c}` });
          c++;
        }
      }
    }
    return cells;
  }, [fen]);

  // Ambient border glow based on active agent
  const borderGlow = pulse.isThinking
    ? pulse.activeAgentIndex === 0
      ? '0 0 20px rgba(99, 102, 241, 0.08), 0 0 40px rgba(99, 102, 241, 0.04)'
      : '0 0 20px rgba(30, 30, 46, 0.06), 0 0 40px rgba(30, 30, 46, 0.03)'
    : 'none';

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Header */}
      <div className="flex w-full items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Battlefield</span>
        <div className="flex items-center gap-1.5 bg-primary/8 border border-primary/15 text-primary text-2xs font-semibold px-2.5 py-1 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
          Turn {Math.floor(turn / 2) + 1}
        </div>
      </div>

      {/* Board Container with ambient glow */}
      <motion.div
        className="relative"
        animate={{ boxShadow: borderGlow }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
        style={{ borderRadius: 12 }}
      >
        {/* Thinking indicator bar */}
        {pulse.isThinking && (
          <motion.div
            className="absolute -top-1 left-4 right-4 h-[2px] rounded-full z-20"
            style={{
              background: pulse.activeAgentIndex === 0
                ? 'linear-gradient(90deg, transparent, hsl(234, 62%, 56%), transparent)'
                : 'linear-gradient(90deg, transparent, hsl(220, 20%, 20%), transparent)',
            }}
            initial={{ opacity: 0, scaleX: 0.5 }}
            animate={{ opacity: [0.3, 0.7, 0.3], scaleX: [0.5, 1, 0.5] }}
            transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
          />
        )}

        <div className="flex">
          {/* Rank Labels (left) */}
          <div className="flex flex-col justify-around pr-1.5">
            {[8, 7, 6, 5, 4, 3, 2, 1].map(r => (
              <div key={r} className="text-3xs font-semibold text-muted-foreground/40 h-10 flex items-center select-none">{r}</div>
            ))}
          </div>

          {/* Board Grid */}
          <div>
            <div
              className="grid grid-cols-8 grid-rows-8 rounded-xl overflow-hidden border border-border/50 shadow-panel"
              style={{ width: 320, height: 320 }}
            >
              {board.map(({ row, col, piece, key }) => {
                const isDark = (row + col) % 2 === 1;
                const symbol = piece ? PIECE_MAP[piece] : '';
                const isWhitePiece = piece === piece.toUpperCase() && piece !== '';

                return (
                  <div
                    key={key}
                    className={`relative flex items-center justify-center transition-colors duration-500 ${
                      isDark ? 'bg-na-board-dark' : 'bg-na-board-light'
                    }`}
                  >
                    <AnimatePresence mode="wait">
                      {symbol && (
                        <motion.span
                          key={`${key}-${piece}`}
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.6, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 350, damping: 22, mass: 0.5 }}
                          className={`text-[22px] leading-none select-none ${
                            isWhitePiece
                              ? 'text-stone-400 drop-shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
                              : 'text-stone-900 drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]'
                          }`}
                        >
                          {symbol}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* File Labels (bottom) */}
            <div className="flex mt-1">
              {FILES.map(f => (
                <div key={f} className="flex-1 text-center text-3xs font-semibold text-muted-foreground/40 select-none">
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* FEN Display */}
      <div className="w-full font-telemetry text-3xs text-muted-foreground/40 text-center bg-muted/30 py-1.5 px-3 rounded-lg border border-border/30 truncate max-w-[360px]">
        {fen}
      </div>
    </div>
  );
};
