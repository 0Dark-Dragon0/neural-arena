import React, { useState, useEffect } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { socketClient } from '../streaming/socket';
import { Activity } from 'lucide-react';
import { motion } from 'framer-motion';

export const SetupScreen: React.FC = () => {
  const [agent1Key, setAgent1Key] = useState(localStorage.getItem('na_a1_key') || '');
  const [agent1Model, setAgent1Model] = useState(localStorage.getItem('na_a1_model') || 'google/gemma-3n-e4b-it');
  const [agent1Name, setAgent1Name] = useState(localStorage.getItem('na_a1_name') || 'Gemma-3n-e4b (White)');
  const [agent2Key, setAgent2Key] = useState(localStorage.getItem('na_a2_key') || '');
  const [agent2Model, setAgent2Model] = useState(localStorage.getItem('na_a2_model') || 'google/gemma-3n-e4b-it');
  const [agent2Name, setAgent2Name] = useState(localStorage.getItem('na_a2_name') || 'Gemma-3n-e4b (Black)');
  const [baseUrl, setBaseUrl] = useState(localStorage.getItem('na_base_url') || 'https://integrate.api.nvidia.com/v1');
  const [timeout, setTimeoutVal] = useState(localStorage.getItem('na_timeout') || '120000');

  useEffect(() => {
    localStorage.setItem('na_a1_key', agent1Key);
    localStorage.setItem('na_a1_model', agent1Model);
    localStorage.setItem('na_a1_name', agent1Name);
    localStorage.setItem('na_a2_key', agent2Key);
    localStorage.setItem('na_a2_model', agent2Model);
    localStorage.setItem('na_a2_name', agent2Name);
    localStorage.setItem('na_base_url', baseUrl);
    localStorage.setItem('na_timeout', timeout);
  }, [agent1Key, agent1Model, agent1Name, agent2Key, agent2Model, agent2Name, baseUrl, timeout]);

  const handleStart = () => {
    socketClient.startSimulation({
      agent1: { name: agent1Name, apiKey: agent1Key, baseUrl, model: agent1Model },
      agent2: { name: agent2Name, apiKey: agent2Key, baseUrl, model: agent2Model },
      timeoutMs: parseInt(timeout, 10)
    });
  };

  const handleLaunchDemo = () => {
    socketClient.startSimulation({
      agent1: { name: 'Demo Alpha (White)', apiKey: 'demo-key', baseUrl: 'http://localhost/demo', model: 'demo-chess-model-white' },
      agent2: { name: 'Demo Beta (Black)', apiKey: 'demo-key', baseUrl: 'http://localhost/demo', model: 'demo-chess-model-black' },
      timeoutMs: 120000
    });
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background surface-grain">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-2xl px-6"
      >
        {/* Brand */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground shadow-panel">
            <span className="text-lg font-bold text-background tracking-tight">NA</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Neural Arena</h1>
          <p className="text-sm text-muted-foreground">Configure the autonomous cognitive runtime.</p>
        </div>

        {/* Agent Configuration */}
        <div className="grid grid-cols-2 gap-5">
          {/* Agent White */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-sm">♘</div>
              <div>
                <h3 className="text-xs font-semibold text-foreground">Alpha Node</h3>
                <p className="text-2xs text-muted-foreground">(White)</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">API Key</label>
                <Input type="password" value={agent1Key} onChange={(e) => setAgent1Key(e.target.value)} placeholder="nvapi-..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Model</label>
                <Input value={agent1Model} onChange={(e) => setAgent1Model(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Display Name</label>
                <Input value={agent1Name} onChange={(e) => setAgent1Name(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Agent Black */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-sm text-background">♞</div>
              <div>
                <h3 className="text-xs font-semibold text-foreground">Beta Node</h3>
                <p className="text-2xs text-muted-foreground">(Black)</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">API Key</label>
                <Input type="password" value={agent2Key} onChange={(e) => setAgent2Key(e.target.value)} placeholder="nvapi-..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Model</label>
                <Input value={agent2Model} onChange={(e) => setAgent2Model(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Display Name</label>
                <Input value={agent2Name} onChange={(e) => setAgent2Name(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Global Config + Launch */}
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-card">
            <div className="flex items-center gap-5">
              <div className="space-y-1">
                <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Base URL</label>
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="w-72 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Timeout</label>
                <Input value={timeout} onChange={(e) => setTimeoutVal(e.target.value)} className="w-24 text-center text-xs" />
              </div>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={handleStart}
              disabled={!agent1Key || !agent2Key}
              className="gap-2 shadow-glow-indigo"
            >
              <Activity className="w-4 h-4" />
              Launch Runtime
            </Button>
          </div>
          
          <Button
            variant="secondary"
            size="lg"
            onClick={handleLaunchDemo}
            className="w-full gap-2 border border-dashed border-primary/30 hover:border-primary/60 text-primary bg-primary/5 hover:bg-primary/10 transition-all duration-300 py-3"
          >
            ⚡ Launch Demo Match (No API Keys Required)
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
