/**
 * OnboardingWizard — First-run experience for Neural Arena.
 * 
 * Shown once when no onboarding completion flag exists.
 * Steps: Welcome → Provider Setup → Preferences → Launch
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { useProviderProfiles } from '../state/useProviderProfiles';
import { RUNTIME_PRESETS, RuntimePreset } from '../lib/presets';
import { Activity, ArrowRight, Check, Shield, Zap } from 'lucide-react';

type Step = 'welcome' | 'provider' | 'preferences' | 'ready';
const STEPS: Step[] = ['welcome', 'provider', 'preferences', 'ready'];

interface OnboardingProps {
  onComplete: () => void;
}

export const OnboardingWizard: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>('welcome');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://integrate.api.nvidia.com/v1');
  const [model, setModel] = useState('google/gemma-3n-e4b-it');
  const [profileName, setProfileName] = useState('NVIDIA Gemma');
  const [selectedPreset, setSelectedPreset] = useState('balanced');
  const [telemetryMode, setTelemetryMode] = useState<'local-only' | 'anonymous'>('local-only');

  const saveProfile = useProviderProfiles((s) => s.saveProfile);

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const next = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };

  const handleFinish = () => {
    // Save provider profile
    if (apiKey) {
      const hint = apiKey.length >= 4 ? apiKey.slice(-4) : '****';
      saveProfile({ name: profileName, baseUrl, model, apiKeyHint: hint });
    }

    // Save preferences
    localStorage.setItem('na_default_preset', selectedPreset);
    localStorage.setItem('na_telemetry_mode', telemetryMode);
    localStorage.setItem('na_onboarding_complete', 'true');

    // Persist API key for SetupScreen (existing behavior)
    localStorage.setItem('na_a1_key', apiKey);
    localStorage.setItem('na_a2_key', apiKey);
    localStorage.setItem('na_a1_model', model);
    localStorage.setItem('na_a2_model', model);
    localStorage.setItem('na_base_url', baseUrl);

    onComplete();
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background surface-grain">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg px-6"
      >
        {/* Progress Bar */}
        <div className="mb-8 h-0.5 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        <AnimatePresence mode="wait">
          {/* ── Step 1: Welcome ──────────────────── */}
          {step === 'welcome' && (
            <motion.div key="welcome" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }} className="flex flex-col items-center text-center gap-6"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground shadow-panel">
                <span className="text-xl font-bold text-background tracking-tight">NA</span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome to Neural Arena</h1>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  A deterministic autonomous cognition observatory. Watch AI systems think, adapt, and compete in real time.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 w-full mt-2">
                {[
                  { icon: Zap, label: 'Deterministic Runtime', desc: 'Fully replayable' },
                  { icon: Activity, label: 'Live Observability', desc: 'Mission Control UI' },
                  { icon: Shield, label: 'Privacy First', desc: 'Local-only by default' },
                ].map(f => (
                  <div key={f.label} className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-card p-3">
                    <f.icon className="h-4 w-4 text-primary" />
                    <span className="text-2xs font-semibold text-foreground">{f.label}</span>
                    <span className="text-3xs text-muted-foreground">{f.desc}</span>
                  </div>
                ))}
              </div>
              <Button variant="primary" size="lg" onClick={next} className="gap-2 mt-2">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {/* ── Step 2: Provider Setup ───────────── */}
          {step === 'provider' && (
            <motion.div key="provider" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }} className="flex flex-col gap-5"
            >
              <div className="text-center">
                <h2 className="text-lg font-semibold text-foreground">Connect a Provider</h2>
                <p className="mt-1 text-sm text-muted-foreground">Neural Arena uses your own API keys. Keys stay on your machine.</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card space-y-4">
                <div className="space-y-1.5">
                  <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Profile Name</label>
                  <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="NVIDIA Gemma" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">API Key</label>
                  <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="nvapi-..." />
                  <p className="text-3xs text-muted-foreground/60">Stored locally. Never sent anywhere except your chosen provider.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Base URL</label>
                  <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Model</label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <Button variant="ghost" size="sm" onClick={() => setStep('welcome')}>Back</Button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setApiKey('demo-key');
                      setProfileName('Demo Mode');
                      setBaseUrl('http://localhost/demo');
                      setModel('demo-chess-model-white');
                      // We will also navigate next
                      setTimeout(() => setStep('preferences'), 50);
                    }}
                    type="button"
                    className="px-3 py-1.5 rounded-lg text-2xs font-semibold border border-dashed border-primary/30 hover:border-primary/60 text-primary bg-primary/5 hover:bg-primary/10 transition-all duration-300"
                  >
                    ⚡ Skip & Use Demo Mode
                  </button>
                  <Button variant="primary" size="lg" onClick={next} className="gap-2" disabled={!apiKey}>
                    Continue <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Preferences ──────────────── */}
          {step === 'preferences' && (
            <motion.div key="preferences" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }} className="flex flex-col gap-5"
            >
              <div className="text-center">
                <h2 className="text-lg font-semibold text-foreground">Simulation Preferences</h2>
                <p className="mt-1 text-sm text-muted-foreground">Choose a default runtime profile.</p>
              </div>
              <div className="space-y-2">
                {RUNTIME_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 ${
                      selectedPreset === preset.id
                        ? 'border-primary bg-accent shadow-sm'
                        : 'border-border/50 bg-card hover:border-border'
                    }`}
                  >
                    <span className="text-lg">{preset.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground">{preset.name}</div>
                      <div className="text-2xs text-muted-foreground mt-0.5">{preset.description}</div>
                    </div>
                    {selectedPreset === preset.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                ))}
              </div>

              {/* Telemetry Consent */}
              <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3 mt-1">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Data Privacy</span>
                </div>
                <div className="space-y-2">
                  {[
                    { value: 'local-only' as const, label: 'Local Only', desc: 'All data stays on your machine' },
                    { value: 'anonymous' as const, label: 'Anonymous Telemetry', desc: 'Share anonymized simulation metrics to improve the platform' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTelemetryMode(opt.value)}
                      className={`w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition-all ${
                        telemetryMode === opt.value ? 'bg-accent' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center ${
                        telemetryMode === opt.value ? 'border-primary' : 'border-muted-foreground/30'
                      }`}>
                        {telemetryMode === opt.value && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-foreground">{opt.label}</div>
                        <div className="text-2xs text-muted-foreground">{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" size="sm" onClick={() => setStep('provider')}>Back</Button>
                <Button variant="primary" size="lg" onClick={next} className="gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Ready ────────────────────── */}
          {step === 'ready' && (
            <motion.div key="ready" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }} className="flex flex-col items-center text-center gap-6"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 shadow-panel">
                <Check className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">You're All Set</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  Neural Arena is ready. Configure your agents and launch the autonomous simulation runtime.
                </p>
              </div>
              <div className="w-full rounded-xl border border-border/50 bg-card p-4 space-y-2 text-left text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="font-semibold text-foreground">{profileName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-semibold font-telemetry text-foreground">{model.split('/').pop()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Preset</span>
                  <span className="font-semibold text-foreground">{RUNTIME_PRESETS.find(p => p.id === selectedPreset)?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Privacy</span>
                  <span className="font-semibold text-foreground">{telemetryMode === 'local-only' ? 'Local Only' : 'Anonymous'}</span>
                </div>
              </div>
              <Button variant="primary" size="lg" onClick={handleFinish} className="gap-2 shadow-glow-indigo">
                <Activity className="h-4 w-4" /> Launch Neural Arena
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
