/**
 * CognitiveCore — The living, breathing heart of Neural Arena.
 * 
 * A procedural SVG visualization that reacts to real runtime state.
 * All animation parameters are derived from useRuntimePulse — 
 * no random generators, fully deterministic, replay-compatible.
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRuntimePulse } from '../hooks/useRuntimePulse';

export const CognitiveCore: React.FC = () => {
  const pulse = useRuntimePulse();

  // Derive visual parameters from runtime state
  const coreScale = pulse.isPaused ? 0.92 : pulse.isStopped ? 0.85 : 1 + pulse.intensity * 0.06;
  const coreOpacity = pulse.isStopped ? 0.3 : pulse.isPaused ? 0.5 : 0.4 + pulse.intensity * 0.5;
  const glowRadius = pulse.isStopped ? 0 : 8 + pulse.intensity * 24;
  const glowOpacity = pulse.isStopped ? 0 : 0.08 + pulse.intensity * 0.18;

  // Ring rotation speeds derive from tick progression
  const ring1Phase = (pulse.tick * 0.3) % 360;
  const ring2Phase = (pulse.tick * -0.2) % 360;
  const ring3Phase = (pulse.tick * 0.15) % 360;

  // Thinking indicator: orbital dot speed
  const orbitalSpeed = pulse.isThinking ? 1.5 : pulse.isRunning ? 4 : 0;

  // Active side color
  const agentGlow = pulse.activeAgentIndex === 0 
    ? 'rgba(99, 102, 241, 0.35)' // Indigo for white
    : pulse.activeAgentIndex === 1 
      ? 'rgba(30, 30, 46, 0.4)' // Dark for black
      : 'rgba(148, 163, 184, 0.2)'; // Neutral

  // Error flash
  const errorFlash = pulse.errorPressure > 0.3;

  // Concentric ring opacities based on cognition heat
  const ringOpacities = [
    0.08 + pulse.cognitionHeat * 0.15,
    0.05 + pulse.intentHeat * 0.12,
    0.03 + pulse.worldHeat * 0.1,
  ];

  return (
    <div className="relative flex items-center justify-center" style={{ width: 280, height: 200 }}>
      {/* Ambient glow background */}
      <motion.div
        className="absolute rounded-full"
        animate={{
          width: 120 + glowRadius * 2,
          height: 120 + glowRadius * 2,
          opacity: glowOpacity,
          background: `radial-gradient(circle, ${agentGlow}, transparent 70%)`,
        }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
        style={{ filter: 'blur(20px)' }}
      />

      {/* SVG Core */}
      <motion.svg
        viewBox="0 0 200 200"
        className="relative z-10"
        style={{ width: 200, height: 200 }}
        animate={{ scale: coreScale, opacity: coreOpacity }}
        transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <defs>
          {/* Core gradient */}
          <radialGradient id="coreGrad" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="hsl(0, 0%, 98%)" />
            <stop offset="45%" stopColor="hsl(220, 14%, 92%)" />
            <stop offset="100%" stopColor="hsl(220, 14%, 82%)" />
          </radialGradient>

          {/* Inner light */}
          <radialGradient id="innerLight" cx="50%" cy="40%" r="35%">
            <stop offset="0%" stopColor="white" stopOpacity="0.9" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>

          {/* Thinking pulse */}
          <radialGradient id="thinkPulse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(234, 62%, 56%)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(234, 62%, 56%)" stopOpacity="0" />
          </radialGradient>

          {/* Error pulse */}
          <radialGradient id="errorPulse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(0, 72%, 51%)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="hsl(0, 72%, 51%)" stopOpacity="0" />
          </radialGradient>

          <filter id="softBlur">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>

        {/* Ring 3 — Outermost (World state) */}
        <motion.circle
          cx="100" cy="100" r="88"
          fill="none"
          stroke="hsl(220, 14%, 82%)"
          strokeWidth="0.5"
          strokeDasharray="8 12"
          animate={{
            opacity: ringOpacities[2],
            rotate: ring3Phase,
          }}
          transition={{ duration: 0.5, ease: 'linear' }}
          style={{ transformOrigin: '100px 100px' }}
        />

        {/* Ring 2 — Middle (Intent) */}
        <motion.circle
          cx="100" cy="100" r="72"
          fill="none"
          stroke="hsl(220, 14%, 76%)"
          strokeWidth="0.6"
          strokeDasharray="6 10"
          animate={{
            opacity: ringOpacities[1],
            rotate: ring2Phase,
          }}
          transition={{ duration: 0.5, ease: 'linear' }}
          style={{ transformOrigin: '100px 100px' }}
        />

        {/* Ring 1 — Inner (Cognition) */}
        <motion.circle
          cx="100" cy="100" r="56"
          fill="none"
          stroke="hsl(234, 30%, 78%)"
          strokeWidth="0.7"
          strokeDasharray="4 8"
          animate={{
            opacity: ringOpacities[0],
            rotate: ring1Phase,
          }}
          transition={{ duration: 0.5, ease: 'linear' }}
          style={{ transformOrigin: '100px 100px' }}
        />

        {/* Core sphere — main body */}
        <motion.ellipse
          cx="100" cy="98"
          rx="38" ry="36"
          fill="url(#coreGrad)"
          filter="url(#softBlur)"
          animate={{
            ry: pulse.isThinking ? 37 : 36,
            rx: pulse.isThinking ? 39 : 38,
          }}
          transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
        />

        {/* Inner highlight */}
        <ellipse
          cx="96" cy="90"
          rx="20" ry="16"
          fill="url(#innerLight)"
        />

        {/* Thinking pulse overlay */}
        {pulse.isThinking && (
          <motion.circle
            cx="100" cy="100" r="44"
            fill="url(#thinkPulse)"
            initial={{ opacity: 0, r: 38 }}
            animate={{ opacity: [0.3, 0.6, 0.3], r: [38, 48, 38] }}
            transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity }}
          />
        )}

        {/* Error pressure overlay */}
        {errorFlash && (
          <motion.circle
            cx="100" cy="100" r="44"
            fill="url(#errorPulse)"
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
          />
        )}

        {/* Orbital thinking dot */}
        {pulse.isRunning && (
          <motion.circle
            cx="100" cy="100"
            r="2"
            fill="hsl(234, 62%, 56%)"
            opacity={pulse.isThinking ? 0.8 : 0.25}
            animate={{
              cx: [100 + 52 * Math.cos(0), 100 + 52 * Math.cos(Math.PI / 2), 100 + 52 * Math.cos(Math.PI), 100 + 52 * Math.cos(3 * Math.PI / 2), 100 + 52 * Math.cos(0)],
              cy: [100 + 52 * Math.sin(0), 100 + 52 * Math.sin(Math.PI / 2), 100 + 52 * Math.sin(Math.PI), 100 + 52 * Math.sin(3 * Math.PI / 2), 100 + 52 * Math.sin(0)],
            }}
            transition={{ duration: orbitalSpeed, ease: 'linear', repeat: Infinity }}
          />
        )}

        {/* Bottom shadow */}
        <ellipse
          cx="100" cy="140"
          rx="30" ry="4"
          fill="hsl(220, 14%, 70%)"
          opacity="0.12"
          filter="url(#softBlur)"
        />
      </motion.svg>

      {/* Labels */}
      <div className="absolute top-1 left-0 right-0 flex justify-center">
        <span className="text-3xs font-semibold text-muted-foreground/50 uppercase tracking-[0.2em]">
          Cognition Core
        </span>
      </div>
      <div className="absolute bottom-1 left-0 right-0 flex justify-center">
        <span className="text-3xs text-muted-foreground/40">
          {pulse.isThinking ? 'Decision Making' : pulse.isPaused ? 'Suspended' : pulse.isStopped ? 'Dormant' : 'Processing'}
        </span>
      </div>
    </div>
  );
};
