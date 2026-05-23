/**
 * EngineVisualization — The complete Engine Overview panel.
 * 
 * Combines:
 * - Header with title + labels
 * - Input/Output layer stats
 * - CognitiveCore (animated center)
 * - CognitionPipeline (processing stages)
 * 
 * This is the "soul" of Neural Arena — the runtime made visible.
 */
import React from 'react';
import { CognitiveCore } from '../components/CognitiveCore';
import { CognitionPipeline } from '../components/CognitionPipeline';
import { useRuntimePulse } from '../hooks/useRuntimePulse';
import { motion } from 'framer-motion';

export const EngineVisualization: React.FC = () => {
  const pulse = useRuntimePulse();

  return (
    <div className="flex flex-col items-center w-full animate-fade-in">
      {/* Header */}
      <div className="flex w-full items-center justify-between mb-2">
        <div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Engine Visualization</h3>
          <p className="text-2xs text-muted-foreground mt-0.5">Real-time Autonomous Runtime</p>
        </div>
      </div>

      {/* Core Visualization Area */}
      <div className="relative flex items-center justify-center w-full py-2">
        {/* Input Layer — Left */}
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
          animate={{ opacity: pulse.isRunning ? 0.85 : 0.35 }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-3xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Input Layer</span>
          <span className="text-3xs text-muted-foreground/40">World State</span>
          <motion.div
            className="text-lg font-light text-foreground font-telemetry mt-1"
            key={pulse.turnNumber}
            initial={{ opacity: 0.5, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {pulse.turnNumber}
          </motion.div>
          <span className="text-3xs text-muted-foreground/40">Sources</span>
        </motion.div>

        {/* Cognitive Core */}
        <CognitiveCore />

        {/* Output Layer — Right */}
        <motion.div
          className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
          animate={{ opacity: pulse.isRunning ? 0.85 : 0.35 }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-3xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Output Layer</span>
          <span className="text-3xs text-muted-foreground/40">Action Execution</span>
          <motion.div
            className="text-lg font-light text-foreground font-telemetry mt-1"
            key={Math.floor(pulse.turnNumber / 2)}
            initial={{ opacity: 0.5, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {Math.floor(pulse.turnNumber / 2)}
          </motion.div>
          <span className="text-3xs text-muted-foreground/40">Targets</span>
        </motion.div>

        {/* Connection lines to core */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ overflow: 'visible' }}>
          {/* Left line */}
          <motion.line
            x1="15%" y1="50%" x2="30%" y2="50%"
            stroke="hsl(220, 13%, 86%)"
            strokeWidth="0.5"
            strokeDasharray="4 6"
            animate={{ opacity: pulse.isRunning ? 0.4 : 0.1 }}
            transition={{ duration: 0.8 }}
          />
          {/* Right line */}
          <motion.line
            x1="70%" y1="50%" x2="85%" y2="50%"
            stroke="hsl(220, 13%, 86%)"
            strokeWidth="0.5"
            strokeDasharray="4 6"
            animate={{ opacity: pulse.isRunning ? 0.4 : 0.1 }}
            transition={{ duration: 0.8 }}
          />
        </svg>
      </div>

      {/* Memory Layer Label */}
      <div className="flex flex-col items-center gap-0.5 mb-3 mt-1">
        <div className="h-3 w-px bg-border/30" />
        <div className="flex items-center gap-1.5">
          <div className="h-1 w-1 rounded-full bg-muted-foreground/20" />
          <span className="text-3xs text-muted-foreground/40 uppercase tracking-wider">Memory Layer</span>
        </div>
        <span className="text-3xs text-muted-foreground/30">Tactical + Episodic</span>
      </div>

      {/* Cognition Pipeline */}
      <CognitionPipeline />
    </div>
  );
};
