import React from 'react';
import { useDashboardStore } from '../state/useDashboardStore';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { AgentTelemetry } from '../lib/types';
import { Badge } from '../components/ui/Badge';
import { motion } from 'framer-motion';
import { useRuntimePulse } from '../hooks/useRuntimePulse';

interface AgentCognitionPanelProps {
  side?: 'white' | 'black' | 'both';
}

export const AgentCognitionPanel: React.FC<AgentCognitionPanelProps> = ({ side = 'both' }) => {
  const agents = useDashboardStore((s) => s.agents);
  const activeAgentIndex = useDashboardStore((s) => s.world.activeAgentIndex);

  if (side === 'white') {
    return <AgentCard index={0} label="Agent White" side="white" isActive={activeAgentIndex === 0} telemetry={agents[0]} />;
  }
  if (side === 'black') {
    return <AgentCard index={1} label="Agent Black" side="black" isActive={activeAgentIndex === 1} telemetry={agents[1]} />;
  }

  return (
    <div className="flex gap-4 w-full">
      <AgentCard index={0} label="Agent White" side="white" isActive={activeAgentIndex === 0} telemetry={agents[0]} />
      <AgentCard index={1} label="Agent Black" side="black" isActive={activeAgentIndex === 1} telemetry={agents[1]} />
    </div>
  );
};

interface AgentCardProps {
  index: number;
  label: string;
  side: 'white' | 'black';
  isActive: boolean;
  telemetry?: AgentTelemetry;
}

const AgentCard: React.FC<AgentCardProps> = ({ label, side, isActive, telemetry }) => {
  const pulse = useRuntimePulse();

  const lifecycleBadge = (): { variant: 'success' | 'thinking' | 'error' | 'muted'; label: string } => {
    if (!telemetry) return { variant: 'muted', label: 'IDLE' };
    switch (telemetry.lifecycle) {
      case 'THINKING': return { variant: 'thinking', label: 'Thinking...' };
      case 'ACCEPTED': return { variant: 'success', label: 'Accepted' };
      case 'REJECTED': return { variant: 'error', label: 'Rejected' };
      case 'ERROR': return { variant: 'error', label: 'Error' };
      default: return { variant: 'muted', label: telemetry.lifecycle || 'IDLE' };
    }
  };

  const badge = lifecycleBadge();

  return (
    <motion.div
      className={`relative flex flex-col rounded-2xl border p-4 transition-all duration-500 ${
        isActive
          ? 'border-primary/20 bg-card shadow-panel'
          : 'border-border/30 bg-muted/20'
      }`}
      animate={{ opacity: isActive ? 1 : 0.55 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          className="absolute top-0 left-3 right-3 h-[2px] rounded-full bg-primary/60"
          layoutId="agent-active"
          transition={{ type: "spring", stiffness: 250, damping: 28 }}
        />
      )}

      {/* Breathing outline for thinking state */}
      {isActive && pulse.isThinking && (
        <motion.div
          className="absolute inset-0 rounded-2xl border border-primary/15 pointer-events-none"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity }}
        />
      )}

      {/* Agent Identity */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm shrink-0 ${
          side === 'white' ? 'bg-muted text-foreground' : 'bg-foreground text-background'
        }`}>
          {side === 'white' ? '♘' : '♞'}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-2xs font-semibold text-foreground truncate">{label}</span>
          <span className="text-3xs text-muted-foreground truncate">Gemma-3n-e4b</span>
        </div>
      </div>

      {/* Lifecycle Badge */}
      <div className="mb-3">
        <Badge variant={badge.variant} dot pulse={telemetry?.lifecycle === 'THINKING'}>
          {telemetry?.lifecycle === 'THINKING' && <Loader2 className="h-3 w-3 animate-spin" />}
          {telemetry?.lifecycle === 'ACCEPTED' && <CheckCircle2 className="h-3 w-3" />}
          {telemetry?.lifecycle === 'REJECTED' && <XCircle className="h-3 w-3" />}
          {badge.label}
        </Badge>
      </div>

      {/* Compact Telemetry */}
      <div className="space-y-2 text-2xs">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Confidence</span>
          <div className="flex items-center gap-1.5">
            <div className="h-1 w-8 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary/50"
                animate={{ width: '82%' }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <span className="font-telemetry font-semibold text-foreground">0.82</span>
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Style</span>
          <span className="font-medium text-foreground">Balanced</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Escalation</span>
          <span className="font-telemetry font-semibold text-foreground">Lv {telemetry?.escalationLevel || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Last Move</span>
          <span className="font-telemetry font-semibold text-foreground">{telemetry?.lastAction || '—'}</span>
        </div>
      </div>
    </motion.div>
  );
};
