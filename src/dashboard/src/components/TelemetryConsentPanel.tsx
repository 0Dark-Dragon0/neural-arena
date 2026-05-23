/**
 * TelemetryConsentPanel — Full telemetry consent and review UI.
 * 
 * Users can:
 * - Choose local-only or anonymous sharing mode
 * - Toggle individual telemetry categories
 * - Preview exactly what gets collected
 * - Revoke consent and delete all data
 */
import React, { useEffect, useState } from 'react';
import { useTelemetryConsent, TelemetryConsentCategories } from '../state/useTelemetryConsent';
import { collectTelemetry, anonymizePacket, TelemetryPacket } from '../lib/telemetry/TelemetryCollector';
import { useDashboardStore } from '../state/useDashboardStore';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Shield, Eye, Trash2, Check } from 'lucide-react';

const CATEGORY_INFO: { key: keyof TelemetryConsentCategories; label: string; description: string }[] = [
  { key: 'cognitionTiming', label: 'Cognition Timing', description: 'Average thinking time, escalation/correction counts' },
  { key: 'orchestrationBehavior', label: 'Orchestration Behavior', description: 'Ticks per move, FSM transitions, event density' },
  { key: 'modelPerformance', label: 'Model Performance', description: 'Decision quality, hallucination rate, consistency' },
  { key: 'providerReliability', label: 'Provider Reliability', description: 'Average latency, error rate, fallback count' },
  { key: 'errorPatterns', label: 'Error Patterns', description: 'Rejection counts, provider errors, escalation depth' },
];

export const TelemetryConsentPanel: React.FC = () => {
  const consent = useTelemetryConsent();
  const events = useDashboardStore((s) => s.events);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<TelemetryPacket | null>(null);

  useEffect(() => { consent.loadConsent(); }, []);

  const handlePreview = () => {
    const chronoEvents = [...events].reverse();
    const raw = collectTelemetry(chronoEvents);
    const anonymized = anonymizePacket(raw);
    setPreview(anonymized);
    setShowPreview(true);
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Telemetry & Privacy</h2>
          <p className="text-2xs text-muted-foreground mt-0.5">Control what data Neural Arena collects.</p>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="space-y-2">
        {[
          { value: 'local-only' as const, label: 'Local Only', desc: 'All telemetry stays on your machine. Nothing leaves your device.', badge: 'Default' },
          { value: 'anonymous-sharing' as const, label: 'Anonymous Sharing', desc: 'Share anonymized metrics to improve the platform. Fully inspectable.', badge: 'Opt-in' },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => consent.setMode(opt.value)}
            className={`w-full flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 ${
              consent.mode === opt.value
                ? 'border-primary bg-accent/50 shadow-sm'
                : 'border-border/50 bg-card hover:border-border'
            }`}
          >
            <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              consent.mode === opt.value ? 'border-primary' : 'border-muted-foreground/30'
            }`}>
              {consent.mode === opt.value && <div className="h-2 w-2 rounded-full bg-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                <Badge variant={opt.value === 'local-only' ? 'success' : 'info'}>{opt.badge}</Badge>
              </div>
              <p className="text-2xs text-muted-foreground mt-1">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Category Toggles — only visible in anonymous mode */}
      {consent.mode === 'anonymous-sharing' && (
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          <h3 className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Data Categories</h3>
          {CATEGORY_INFO.map(cat => (
            <label key={cat.key} className="flex items-start gap-3 cursor-pointer group">
              <div className="mt-0.5">
                <input
                  type="checkbox"
                  checked={consent.categories[cat.key]}
                  onChange={(e) => consent.setCategory(cat.key, e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border text-primary accent-primary cursor-pointer"
                />
              </div>
              <div>
                <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{cat.label}</span>
                <p className="text-2xs text-muted-foreground mt-0.5">{cat.description}</p>
              </div>
            </label>
          ))}
        </div>
      )}

      {/* Preview Button */}
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={handlePreview} className="gap-1.5 flex-1">
          <Eye className="h-3.5 w-3.5" /> Preview What Gets Collected
        </Button>
        {consent.consentedAt && (
          <Button variant="ghost" size="sm" onClick={() => consent.revokeConsent()} className="gap-1.5 text-muted-foreground">
            Revoke Consent
          </Button>
        )}
      </div>

      {/* Save / Grant */}
      {consent.mode === 'anonymous-sharing' && !consent.consentedAt && (
        <Button variant="primary" size="lg" onClick={() => consent.grantConsent()} className="gap-2">
          <Check className="h-4 w-4" /> Grant Consent
        </Button>
      )}

      {consent.consentedAt && (
        <div className="text-2xs text-muted-foreground/60 text-center">
          Consent granted on {new Date(consent.consentedAt).toLocaleDateString()}
        </div>
      )}

      {/* Delete All Data */}
      <div className="border-t border-border/30 pt-4">
        <Button variant="ghost" size="sm" onClick={() => consent.deleteAllData()}
          className="gap-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 w-full justify-center">
          <Trash2 className="h-3.5 w-3.5" /> Delete All Telemetry Data
        </Button>
      </div>

      {/* Preview Panel */}
      {showPreview && preview && (
        <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Anonymized Preview</h4>
            <button onClick={() => setShowPreview(false)} className="text-2xs text-muted-foreground hover:text-foreground">Close</button>
          </div>
          <pre className="text-3xs font-telemetry text-foreground/80 overflow-x-auto bg-card rounded-lg p-3 border border-border/30 max-h-60 overflow-y-auto">
            {JSON.stringify(preview, null, 2)}
          </pre>
          <p className="text-3xs text-muted-foreground/50 text-center">
            This is exactly what would be shared. No API keys, prompts, or personal data.
          </p>
        </div>
      )}
    </div>
  );
};
