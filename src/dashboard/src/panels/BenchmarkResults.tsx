/**
 * BenchmarkResults — Post-match benchmark scoring panel.
 * 
 * Displays domain-agnostic agent scores with radar visualization
 * and exportable benchmark results.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useDashboardStore } from '../state/useDashboardStore';
import { useReplayLibrary } from '../state/useReplayLibrary';
import { scoreBenchmark } from '../../../lib/benchmark/BenchmarkScorer';
import { BenchmarkResult, AgentBenchmark } from '../../../lib/benchmark/BenchmarkSchema';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Download, BarChart3, Target } from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend
} from 'recharts';

function ScoreBar({ label, value, max = 1 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-2xs text-muted-foreground">{label}</span>
        <span className="text-2xs font-telemetry font-semibold text-foreground">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AgentCard({ agent, label }: { agent: AgentBenchmark; label: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/45 p-4 space-y-3 shadow-sm hover:border-border/60 transition-colors">
      <div className="flex items-center justify-between pb-2 border-b border-border/20">
        <div>
          <h4 className="text-xs font-semibold text-foreground font-telemetry">{label}</h4>
          <span className="text-3xs text-muted-foreground font-mono truncate max-w-[150px] block">{agent.modelFamily}</span>
        </div>
        <Badge variant={agent.decisionQuality >= 0.8 ? 'success' : agent.decisionQuality >= 0.5 ? 'warning' : 'error'}>
          {(agent.decisionQuality * 100).toFixed(0)}% Quality
        </Badge>
      </div>
      <div className="space-y-2">
        <ScoreBar label="Decision Quality" value={agent.decisionQuality} />
        <ScoreBar label="Adaptation" value={agent.adaptationScore} />
        <ScoreBar label="Consistency" value={agent.consistencyScore} />
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs text-muted-foreground">Hallucination Rate</span>
            <span className="text-2xs font-telemetry font-semibold text-foreground">{(agent.hallucinationRate * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${agent.hallucinationRate <= 0.1 ? 'bg-emerald-500' : agent.hallucinationRate <= 0.3 ? 'bg-amber-500' : 'bg-rose-500'} transition-all duration-500`}
              style={{ width: `${Math.min(agent.hallucinationRate * 100, 100)}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border/20">
          <span className="text-2xs text-muted-foreground">Avg Response</span>
          <span className="text-2xs font-telemetry font-semibold text-foreground">{agent.avgResponseTimeMs.toLocaleString()}ms</span>
        </div>
      </div>
    </div>
  );
}

export const BenchmarkResults: React.FC = React.memo(() => {
  const events = useDashboardStore((s) => s.events);
  const entries = useReplayLibrary((s) => s.entries);
  const getReplayEvents = useReplayLibrary((s) => s.getReplayEvents);
  const loadLibrary = useReplayLibrary((s) => s.loadLibrary);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const benchmark = useMemo<BenchmarkResult | null>(() => {
    let chronoEvents = [...events].reverse();
    if (chronoEvents.length < 10 && entries.length > 0) {
      const recentId = entries[0].id;
      const recentEvents = getReplayEvents(recentId);
      if (recentEvents && recentEvents.length >= 10) {
        chronoEvents = [...recentEvents];
      }
    }
    if (chronoEvents.length < 10) return null;
    return scoreBenchmark(chronoEvents, 'chess');
  }, [events, entries, getReplayEvents]);

  if (!benchmark) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 animate-fade-in text-center">
        <div className="h-12 w-12 rounded-2xl bg-muted/20 border border-border/40 flex items-center justify-center mb-1">
          <BarChart3 className="h-6 w-6 text-muted-foreground/30 animate-pulse" />
        </div>
        <h4 className="text-sm font-semibold text-foreground">Awaiting Performance Data</h4>
        <p className="text-xs text-muted-foreground max-w-[280px]">
          No matches found in the library or the event log. Complete a simulation match to generate a live telemetry benchmark.
        </p>
      </div>
    );
  }

  const nameWhite = `White (${benchmark.agents[0].modelFamily.split('/').pop() || 'Alpha'})`;
  const nameBlack = `Black (${benchmark.agents[1].modelFamily.split('/').pop() || 'Beta'})`;

  const radarData = [
    { metric: 'Decision Quality', [nameWhite]: benchmark.agents[0].decisionQuality * 100, [nameBlack]: benchmark.agents[1].decisionQuality * 100 },
    { metric: 'Adaptation', [nameWhite]: benchmark.agents[0].adaptationScore * 100, [nameBlack]: benchmark.agents[1].adaptationScore * 100 },
    { metric: 'Consistency', [nameWhite]: benchmark.agents[0].consistencyScore * 100, [nameBlack]: benchmark.agents[1].consistencyScore * 100 },
    { metric: 'Reliability', [nameWhite]: (1 - benchmark.agents[0].hallucinationRate) * 100, [nameBlack]: (1 - benchmark.agents[1].hallucinationRate) * 100 },
  ];

  const barData = [
    { name: nameWhite, Latency: benchmark.agents[0].avgResponseTimeMs },
    { name: nameBlack, Latency: benchmark.agents[1].avgResponseTimeMs },
  ];

  const handleExport = () => {
    const json = JSON.stringify(benchmark, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmark-${benchmark.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
            <Target className="h-4 w-4 text-primary animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider font-telemetry">Agent Capabilities</h3>
            <p className="text-3xs text-muted-foreground">Domain-agnostic scoring metrics and cognitive evaluation</p>
          </div>
          <Badge variant="muted">{benchmark.domain}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={handleExport} className="gap-1.5 text-muted-foreground border border-border/20 bg-muted/10 hover:bg-muted/30">
          <Download className="h-3.5 w-3.5" /> {exported ? 'Exported!' : 'Export JSON'}
        </Button>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar Chart Panel */}
        <div className="rounded-xl border border-border/40 bg-card/60 p-4 flex flex-col">
          <span className="text-3xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 font-telemetry">Cognition Metrics (Radar)</span>
          <div className="flex-1 flex items-center justify-center min-h-[240px]">
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#2e2e33" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#8e8e93', fontSize: 9, fontFamily: 'monospace' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#48484a', fontSize: 8 }} />
                <Radar name={nameWhite} dataKey={nameWhite} stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
                <Radar name={nameBlack} dataKey={nameBlack} stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1c1c1e', borderColor: '#2c2c2e', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '11px', color: '#f2f2f7' }}
                  labelStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#8e8e93', fontFamily: 'monospace' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Latency Bar Chart Panel */}
        <div className="rounded-xl border border-border/40 bg-card/60 p-4 flex flex-col">
          <span className="text-3xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 font-telemetry">Mean Decision Latency (ms)</span>
          <div className="flex-1 flex items-center justify-center min-h-[240px]">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e2e33" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#8e8e93', fontSize: 9 }} />
                <YAxis tick={{ fill: '#8e8e93', fontSize: 9 }} width={45} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1c1c1e', borderColor: '#2c2c2e', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '11px', color: '#f2f2f7' }}
                  labelStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#8e8e93', fontFamily: 'monospace' }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="Latency" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#8b5cf6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Agent Comparison Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {benchmark.agents.map((agent, i) => (
          <AgentCard key={agent.agentIndex} agent={agent} label={i === 0 ? 'Alpha (White)' : 'Beta (Black)'} />
        ))}
      </div>

      {/* System Metrics */}
      <div className="rounded-xl border border-border/40 bg-card p-4 space-y-3">
        <h4 className="text-3xs font-bold text-muted-foreground uppercase tracking-widest font-telemetry">Telemetry Summary</h4>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-2xs">
          <div className="flex justify-between border-b border-border/10 pb-1">
            <span className="text-muted-foreground">Match Duration</span>
            <span className="font-telemetry font-semibold text-foreground">{(benchmark.durationMs / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex justify-between border-b border-border/10 pb-1">
            <span className="text-muted-foreground">Total Ticks</span>
            <span className="font-telemetry font-semibold text-foreground">{benchmark.orchestration.totalTicks.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-b border-border/10 pb-1">
            <span className="text-muted-foreground">FSM Transitions</span>
            <span className="font-telemetry font-semibold text-foreground">{benchmark.orchestration.fsmTransitions}</span>
          </div>
          <div className="flex justify-between border-b border-border/10 pb-1">
            <span className="text-muted-foreground">Intent Throughput</span>
            <span className="font-telemetry font-semibold text-foreground">{benchmark.orchestration.intentThroughput}/min</span>
          </div>
          <div className="flex justify-between border-b border-border/10 pb-1">
            <span className="text-muted-foreground">Event Density</span>
            <span className="font-telemetry font-semibold text-foreground">{benchmark.orchestration.eventDensity}/tick</span>
          </div>
          <div className="flex justify-between border-b border-border/10 pb-1">
            <span className="text-muted-foreground">Cognitive Self-Correction Rate</span>
            <span className="font-telemetry font-semibold text-foreground">{(benchmark.cognition.correctionRate * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
});

BenchmarkResults.displayName = 'BenchmarkResults';

