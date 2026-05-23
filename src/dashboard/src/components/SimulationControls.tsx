import React, { useRef } from 'react';
import { Play, Pause, Square, RotateCcw, Download, Upload, Settings, SkipBack, SkipForward, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { socketClient } from '../streaming/socket';
import { useDashboardStore } from '../state/useDashboardStore';
import { useReplayStore } from '../state/useReplayStore';

export const SimulationControls: React.FC = () => {
  const simulationState = useDashboardStore((s) => s.simulationState);
  const replay = useReplayStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = replay.exportTrace();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neural-arena-trace-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        replay.importTrace(reader.result);
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  // ── Replay Mode Controls ──────────────────
  if (replay.isReplayMode) {
    return (
      <div className="flex h-[52px] shrink-0 items-center justify-between border-t border-border/50 bg-card px-6 shadow-dock">
        {/* Left: Replay Playback */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => replay.prevMove()} title="Previous Move">
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => replay.stepBackward()} title="Step Back">
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {replay.isPlaying ? (
            <Button variant="ghost" size="icon"
              className="rounded-xl h-9 w-9 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              onClick={() => replay.pause()} title="Pause Playback">
              <Pause className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon"
              className="rounded-xl h-9 w-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={() => replay.play()} title="Play">
              <Play className="h-4 w-4" />
            </Button>
          )}

          <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => replay.stepForward()} title="Step Forward">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => replay.nextMove()} title="Next Move">
            <SkipForward className="h-4 w-4" />
          </Button>

          <div className="w-px h-5 bg-border/60 mx-2" />

          {/* Speed Control */}
          <div className="flex items-center gap-1">
            {[0.5, 1, 2, 4].map(s => (
              <button
                key={s}
                onClick={() => replay.setSpeed(s)}
                className={`px-1.5 py-0.5 rounded text-3xs font-semibold transition-all duration-200 ${
                  replay.speed === s
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground/50 hover:text-muted-foreground'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Center: Replay Badge */}
        <Badge variant="warning" dot>Replay Mode</Badge>

        {/* Right: Exit */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground hover:text-foreground gap-1.5"
            onClick={handleExport} title="Export Trace">
            <Download className="h-3.5 w-3.5" />
            <span className="text-2xs">Export</span>
          </Button>
          <Button variant="ghost" size="sm"
            className="rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 gap-1.5"
            onClick={() => replay.exitReplay()} title="Exit Replay">
            <X className="h-3.5 w-3.5" />
            <span className="text-2xs">Exit Replay</span>
          </Button>
        </div>
      </div>
    );
  }

  // ── Live Mode Controls ────────────────────
  return (
    <div className="flex h-[52px] shrink-0 items-center justify-between border-t border-border/50 bg-card px-6 shadow-dock">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelected} />

      {/* Left: Playback Controls */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon"
          className="rounded-xl h-9 w-9 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
          onClick={() => simulationState === 'paused' ? socketClient.resumeSimulation() : undefined}
          disabled={simulationState === 'running'} title="Resume">
          <Play className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon"
          className="rounded-xl h-9 w-9 text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
          onClick={() => socketClient.pauseSimulation()}
          disabled={simulationState !== 'running'} title="Pause">
          <Pause className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon"
          className="rounded-xl h-9 w-9 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
          onClick={() => socketClient.stopSimulation()}
          disabled={simulationState !== 'running' && simulationState !== 'paused'} title="Stop">
          <Square className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-5 bg-border/60 mx-2" />
        <Button variant="ghost" size="icon"
          className="rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground" title="Restart">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Center: Brand Mark */}
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
        <span className="text-2xs font-bold text-background">NA</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm"
          className="rounded-xl text-muted-foreground hover:text-foreground gap-1.5"
          onClick={handleExport} title="Export Trace">
          <Download className="h-3.5 w-3.5" />
          <span className="text-2xs">Export</span>
        </Button>
        <Button variant="ghost" size="sm"
          className="rounded-xl text-muted-foreground hover:text-foreground gap-1.5"
          onClick={handleImport} title="Load Replay">
          <Upload className="h-3.5 w-3.5" />
          <span className="text-2xs">Replay</span>
        </Button>
        <Button variant="ghost" size="sm"
          className="rounded-xl text-muted-foreground hover:text-foreground gap-1.5"
          onClick={() => replay.enterReplay()} title="Enter Replay Mode">
          <SkipBack className="h-3.5 w-3.5" />
          <span className="text-2xs">Review</span>
        </Button>
        <Button variant="ghost" size="icon"
          className="rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground" title="Settings">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
