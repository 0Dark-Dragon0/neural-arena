import React, { useState, useMemo, useRef } from 'react';
import { useReplayLibrary, ReplayEntry } from '../state/useReplayLibrary';
import { useReplayStore } from '../state/useReplayStore';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Search, Play, Download, Trash2, Upload, Clock, Swords } from 'lucide-react';

function relativeTime(date: string): string {
  const d = Date.now() - new Date(date).getTime();
  if (d < 60000) return 'just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

const resultVariant: Record<string, 'success' | 'warning' | 'error' | 'muted' | 'info'> = {
  checkmate: 'success',
  stalemate: 'warning',
  draw: 'warning',
  timeout: 'error',
  'in-progress': 'info',
  unknown: 'muted',
};

type SortMode = 'recent' | 'longest' | 'most-moves';

export const ReplayLibrary: React.FC = React.memo(() => {
  const { entries, deleteReplay, getReplayEvents, exportReplay, importReplay, loadLibrary } = useReplayLibrary();
  const enterReplay = useReplayStore((s) => s.enterReplay);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => { loadLibrary(); }, []);

  const filtered = useMemo(() => {
    let list = entries;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.agents.white.toLowerCase().includes(q) || e.agents.black.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sort === 'recent') sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sort === 'longest') sorted.sort((a, b) => b.durationTicks - a.durationTicks);
    else sorted.sort((a, b) => b.moveCount - a.moveCount);
    return sorted;
  }, [entries, search, sort]);

  const handlePlay = (entry: ReplayEntry) => {
    const events = getReplayEvents(entry.id);
    if (events) enterReplay(events);
  };

  const handleExport = (entry: ReplayEntry) => {
    const json = exportReplay(entry.id);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entry.name.replace(/\s+/g, '-').toLowerCase()}.neural-arena.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => fileInputRef.current?.click();

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') importReplay(reader.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelected} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Replay Library</h2>
          <p className="text-2xs text-muted-foreground mt-0.5">{entries.length} saved sessions</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleImport} className="gap-1.5 text-muted-foreground">
          <Upload className="h-3.5 w-3.5" /> Import
        </Button>
      </div>

      {/* Search + Sort */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search replays..." className="pl-8 text-xs h-8" />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="h-8 rounded-lg border border-border bg-card px-2 text-2xs text-muted-foreground outline-none"
        >
          <option value="recent">Recent</option>
          <option value="longest">Longest</option>
          <option value="most-moves">Most Moves</option>
        </select>
      </div>

      {/* Replay List */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
            <Swords className="h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground/50">
              {search ? 'No replays match your search' : 'No replays yet. Complete a simulation to save your first replay.'}
            </p>
          </div>
        ) : (
          filtered.map(entry => (
            <div key={entry.id} className="rounded-xl border border-border/50 bg-card p-3 hover:border-border transition-colors duration-150">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-foreground truncate">{entry.name}</h4>
                  <div className="flex items-center gap-2 mt-1 text-2xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{relativeTime(entry.createdAt)}</span>
                    <span className="text-muted-foreground/30">·</span>
                    <span>{entry.eventCount.toLocaleString()} events</span>
                  </div>
                </div>
                <Badge variant={resultVariant[entry.result] || 'muted'} dot>
                  {entry.result.replace('-', ' ')}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-2xs text-muted-foreground mb-2.5">
                <span>{entry.agents.white} vs {entry.agents.black}</span>
                <span className="font-telemetry">{entry.moveCount} moves</span>
              </div>

              <div className="flex items-center gap-1">
                <Button variant="primary" size="sm" onClick={() => handlePlay(entry)} className="gap-1 flex-1 h-7 text-2xs">
                  <Play className="h-3 w-3" /> Replay
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleExport(entry)} className="h-7 w-7 text-muted-foreground">
                  <Download className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteReplay(entry.id)} className="h-7 w-7 text-muted-foreground hover:text-rose-500">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
ReplayLibrary.displayName = 'ReplayLibrary';
