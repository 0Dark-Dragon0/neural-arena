import React, { useEffect, useState } from 'react';
import { useDashboardStore } from '../state/useDashboardStore';
import { useReplayStore } from '../state/useReplayStore';
import { useProviderProfiles } from '../state/useProviderProfiles';
import { socketClient } from '../streaming/socket';
import { SetupScreen } from '../components/SetupScreen';
import { OnboardingWizard } from '../components/OnboardingWizard';
import { Sidebar } from '../components/Sidebar';
import { SimulationControls } from '../components/SimulationControls';
import { ReplayTimeline } from '../components/ReplayTimeline';
import { EngineVisualization } from '../panels/EngineVisualization';
import { SimulationViewport } from '../panels/SimulationViewport';
import { EventStream } from '../panels/EventStream';
import { AgentCognitionPanel } from '../panels/AgentCognitionPanel';
import { MatchOverview } from '../panels/MatchOverview';
import { EngineStatusPanel } from '../panels/EngineStatusPanel';
import { MoveHistory } from '../panels/MoveHistory';
import { TelemetryChart } from '../panels/TelemetryChart';
import { RuntimeDiagnostics } from '../panels/RuntimeDiagnostics';
import { ReplayLibrary } from '../panels/ReplayLibrary';
import { BenchmarkResults } from '../panels/BenchmarkResults';
import { ReplayStoryteller } from '../panels/ReplayStoryteller';
import { Badge } from '../components/ui/Badge';
import { Settings, Volume2, VolumeX } from 'lucide-react';
import { audioSynth } from '../lib/audio';

export const DashboardApp: React.FC = () => {
  const simulationState = useDashboardStore((state) => state.simulationState);
  const connectionStatus = useDashboardStore((state) => state.connectionStatus);
  const isMuted = useDashboardStore((state) => state.isMuted);
  const toggleMute = useDashboardStore((state) => state.toggleMute);
  const activeTab = useDashboardStore((state) => state.activeTab);
  const setActiveTab = useDashboardStore((state) => state.setActiveTab);
  
  const isReplayMode = useReplayStore((s) => s.isReplayMode);
  const loadProfiles = useProviderProfiles((s) => s.loadProfiles);
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('na_onboarding_complete') === 'true');
  const [rightPanelTab, setRightPanelTab] = useState<'chronicle' | 'stream'>('chronicle');

  useEffect(() => {
    loadProfiles();
    socketClient.connect();
    return () => {
      socketClient.disconnect();
    };
  }, []);

  // Redirect to dashboard view when replay is started
  useEffect(() => {
    if (isReplayMode) {
      setActiveTab('dashboard');
    }
  }, [isReplayMode, setActiveTab]);

  // ── First-Run Onboarding ────────────────────
  if (!onboarded) {
    return <OnboardingWizard onComplete={() => setOnboarded(true)} />;
  }

  // ── Connecting Screen ───────────────────────
  if (connectionStatus === 'offline' || connectionStatus === 'connecting') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background surface-grain">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground">
            <span className="text-sm font-bold text-background">NA</span>
          </div>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm font-medium text-muted-foreground">Connecting to runtime...</p>
        </div>
      </div>
    );
  }

  // ── Setup Screen ────────────────────────────
  if (simulationState === 'configuring' && !isReplayMode) {
    return <SetupScreen />;
  }

  // ── Mission Control ─────────────────────────
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background surface-grain text-foreground">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Area */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* Top Bar */}
        <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border/50 bg-card/80 px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider font-telemetry">
              {activeTab === 'dashboard' ? 'Simulation Engine' : activeTab === 'replay' ? 'Replay Library' : activeTab === 'telemetry' ? 'Performance Telemetry' : 'System Settings'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {isReplayMode ? (
              <Badge variant="warning" dot>Replay</Badge>
            ) : (
              <Badge variant="success" dot pulse>Live</Badge>
            )}
            <button 
              onClick={() => {
                toggleMute();
                audioSynth.unlock();
              }}
              title={isMuted ? "Unmute sound effects" : "Mute sound effects"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                activeTab === 'settings' 
                  ? 'bg-muted text-primary' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {activeTab === 'dashboard' && (
            <>
              {/* Left Column — Engine Status + Diagnostics */}
              <div className="hidden xl:flex w-[220px] shrink-0 flex-col border-r border-border/30 overflow-y-auto">
                <div className="p-4 border-b border-border/20">
                  <EngineStatusPanel />
                </div>
                <div className="p-4">
                  <RuntimeDiagnostics />
                </div>
              </div>

              {/* Center Column — Simulation Core */}
              <div className="flex flex-1 flex-col items-center gap-5 p-6 overflow-y-auto min-w-0">
                {/* Engine Visualization — The Living Core */}
                <div className="w-full max-w-2xl">
                  <EngineVisualization />
                </div>

                {/* Separator */}
                <div className="w-full max-w-2xl border-t border-border/20" />

                {/* Battlefield + Agents */}
                <div className="flex items-start gap-5 w-full max-w-2xl">
                  <div className="hidden lg:block w-[160px] shrink-0">
                    <AgentCognitionPanel side="white" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <SimulationViewport />
                  </div>
                  <div className="hidden lg:block w-[160px] shrink-0">
                    <AgentCognitionPanel side="black" />
                  </div>
                </div>

                {/* Telemetry Chart */}
                <div className="w-full max-w-2xl mt-2">
                  <TelemetryChart />
                </div>
              </div>

              {/* Right Column — Intelligence */}
              <div className="w-[300px] shrink-0 flex flex-col border-l border-border/30 overflow-hidden">
                <div className="p-4 border-b border-border/30 shrink-0">
                  <MatchOverview />
                </div>
                <div className="h-[180px] p-4 border-b border-border/30 shrink-0">
                  <MoveHistory />
                </div>
                
                {/* Tabbed view for Story vs Events */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex border-b border-border/30 shrink-0 bg-muted/20 p-1 gap-1">
                    <button
                      onClick={() => setRightPanelTab('chronicle')}
                      className={`flex-1 py-1 text-center rounded text-3xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                        rightPanelTab === 'chronicle'
                          ? 'bg-card text-foreground shadow-sm border border-border/10'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Chronicle
                    </button>
                    <button
                      onClick={() => setRightPanelTab('stream')}
                      className={`flex-1 py-1 text-center rounded text-3xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                        rightPanelTab === 'stream'
                          ? 'bg-card text-foreground shadow-sm border border-border/10'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Raw Stream
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    {rightPanelTab === 'chronicle' ? (
                      <ReplayStoryteller />
                    ) : (
                      <div className="p-4 h-full overflow-hidden">
                        <EventStream />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'replay' && (
            <div className="flex-1 overflow-y-auto p-6 flex justify-center">
              <div className="w-full max-w-4xl bg-card border border-border/40 rounded-2xl shadow-card p-6">
                <ReplayLibrary />
              </div>
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div className="flex-1 overflow-y-auto p-6 flex justify-center">
              <div className="w-full max-w-4xl bg-card border border-border/40 rounded-2xl shadow-card p-6">
                <BenchmarkResults />
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto p-6 flex justify-center">
              <div className="w-full max-w-2xl bg-card border border-border/40 rounded-2xl shadow-card p-6 space-y-6">
                <div className="border-b border-border/30 pb-4">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">System Settings</h3>
                  <p className="text-xs text-muted-foreground mt-1">Configure global runtime variables and keys.</p>
                </div>
                <div className="p-4 bg-muted/20 border border-border/20 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">API Connection Base</h4>
                      <p className="text-3xs text-muted-foreground">Vite endpoint for model queries</p>
                    </div>
                    <span className="text-2xs font-telemetry text-muted-foreground bg-muted px-2 py-1 rounded border border-border/20">
                      {localStorage.getItem('na_base_url') || 'https://integrate.api.nvidia.com/v1'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">White Agent Key</h4>
                      <p className="text-3xs text-muted-foreground">Stored secure credentials</p>
                    </div>
                    <span className="text-2xs font-telemetry text-muted-foreground bg-muted px-2 py-1 rounded border border-border/20">
                      {localStorage.getItem('na_a1_key') ? '••••••••' : 'Not configured'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">Black Agent Key</h4>
                      <p className="text-3xs text-muted-foreground">Stored secure credentials</p>
                    </div>
                    <span className="text-2xs font-telemetry text-muted-foreground bg-muted px-2 py-1 rounded border border-border/20">
                      {localStorage.getItem('na_a2_key') ? '••••••••' : 'Not configured'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Replay Timeline — shown only in replay mode */}
        {isReplayMode && <ReplayTimeline />}

        {/* Bottom Control Dock */}
        {activeTab === 'dashboard' && <SimulationControls />}
      </div>
    </div>
  );
};
