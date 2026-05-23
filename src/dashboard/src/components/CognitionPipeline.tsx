/**
 * CognitionPipeline — Visualizes the cognitive processing stages.
 * 
 * Shows the flow: Context Compiled → Strategy Selected → Action Validated → World Updated
 * Each stage lights up based on the most recent event in that category.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { useDashboardStore } from '../state/useDashboardStore';

interface PipelineStage {
  id: string;
  label: string;
  matchTypes: string[];
}

const STAGES: PipelineStage[] = [
  { id: 'context', label: 'Context Compiled', matchTypes: ['CONTEXT_COMPILED', 'PERSONA_BLOCK_INJECTED', 'CONSTRAINT_BLOCK_INJECTED', 'MEMORY_BLOCK_INJECTED'] },
  { id: 'strategy', label: 'Strategy Selected', matchTypes: ['PROMPT_STRATEGY_SELECTED', 'COGNITIVE_GRAPH_TRANSITION', 'FSM_NODE_EXECUTED'] },
  { id: 'validate', label: 'Action Validated', matchTypes: ['ANTICHEAT_PASS', 'ANTICHEAT_FAIL', 'INTENT_ACCEPTED', 'INTENT_REJECTED'] },
  { id: 'world', label: 'World Updated', matchTypes: ['WORLD_STATE_UPDATED'] },
];

export const CognitionPipeline: React.FC = () => {
  const events = useDashboardStore((s) => s.events);
  const simulationState = useDashboardStore((s) => s.simulationState);

  // Find the most recent event matching each stage (from the last ~30 events)
  const recentWindow = events.slice(0, 30);
  
  const stageStates = STAGES.map((stage) => {
    const matchIdx = recentWindow.findIndex(ev => 
      stage.matchTypes.some(t => ev.type === t || ev.type.includes(t))
    );
    const isRecent = matchIdx >= 0 && matchIdx < 8; // Very recent = within last 8 events
    const isActive = matchIdx >= 0 && matchIdx < 3; // Currently active = within last 3 events
    const tickLabel = matchIdx >= 0 ? recentWindow[matchIdx].tick.toLocaleString() : '—';
    return { ...stage, isRecent, isActive, tickLabel };
  });

  const isRunning = simulationState === 'running';

  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-xl mx-auto">
      {stageStates.map((stage, i) => (
        <React.Fragment key={stage.id}>
          {/* Stage Node */}
          <motion.div
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-2xs font-semibold transition-all duration-500 ${
              stage.isActive && isRunning
                ? 'border-primary/30 bg-primary/8 text-primary shadow-glow-indigo'
                : stage.isRecent && isRunning
                  ? 'border-border bg-card text-foreground/70'
                  : 'border-border/40 bg-muted/30 text-muted-foreground/50'
            }`}
            animate={{
              scale: stage.isActive && isRunning ? 1.02 : 1,
            }}
            transition={{ duration: 0.3 }}
          >
            {/* Activity dot */}
            <div className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${
              stage.isActive && isRunning
                ? 'bg-primary animate-pulse-dot'
                : stage.isRecent && isRunning
                  ? 'bg-muted-foreground/40'
                  : 'bg-muted-foreground/20'
            }`} />
            <span className="whitespace-nowrap">{stage.label}</span>
            <span className={`font-telemetry text-3xs transition-colors duration-500 ${
              stage.isActive && isRunning ? 'text-primary/60' : 'text-muted-foreground/30'
            }`}>
              {stage.tickLabel}
            </span>
          </motion.div>

          {/* Connector arrow */}
          {i < stageStates.length - 1 && (
            <div className="flex items-center px-1">
              <motion.div
                className="h-px w-4 bg-border/40"
                animate={{
                  backgroundColor: stageStates[i].isActive && isRunning
                    ? 'hsl(234, 62%, 56%)'
                    : 'hsl(220, 13%, 91%)',
                  opacity: stageStates[i].isActive && isRunning ? 0.4 : 0.2,
                }}
                transition={{ duration: 0.5 }}
              />
              <svg width="6" height="8" viewBox="0 0 6 8" className="text-border/40">
                <path d="M1 1 L5 4 L1 7" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
