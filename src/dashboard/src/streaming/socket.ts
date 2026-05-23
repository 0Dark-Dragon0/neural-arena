import { io, Socket } from 'socket.io-client';
import { RuntimeEvent } from '../lib/types';
import { useDashboardStore } from '../state/useDashboardStore';
import { useReplayStore } from '../state/useReplayStore';

const SOCKET_URL = 'http://localhost:4000';
const MAX_RECONNECT_ATTEMPTS = 20;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 15000;

class SocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;

  connect() {
    if (this.socket) return;

    this.socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: BASE_RECONNECT_DELAY,
      reconnectionDelayMax: MAX_RECONNECT_DELAY,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      useDashboardStore.getState().setConnectionStatus('live');
      console.log('[Socket] Connected to runtime');
      // Start session backup timer
      this.startSessionBackup();
    });

    this.socket.on('disconnect', (reason) => {
      // Don't set offline during replay — user is just reviewing
      if (!useReplayStore.getState().isReplayMode) {
        useDashboardStore.getState().setConnectionStatus('offline');
      }
      console.log(`[Socket] Disconnected: ${reason}`);
    });

    this.socket.on('reconnect_attempt', (attempt: number) => {
      this.reconnectAttempts = attempt;
      useDashboardStore.getState().setConnectionStatus('connecting');
      console.log(`[Socket] Reconnecting... attempt ${attempt}`);
    });

    this.socket.on('reconnect', () => {
      this.reconnectAttempts = 0;
      useDashboardStore.getState().setConnectionStatus('live');
      console.log('[Socket] Reconnected successfully');
    });

    this.socket.on('reconnect_failed', () => {
      useDashboardStore.getState().setConnectionStatus('offline');
      console.error('[Socket] Reconnection failed after max attempts');
    });

    this.socket.on('status', (data: { isRunning: boolean; isPaused?: boolean }) => {
      // Don't override state during replay mode
      if (useReplayStore.getState().isReplayMode) return;

      let state: 'configuring' | 'running' | 'paused' | 'stopped' = 'configuring';
      if (data.isRunning) {
        state = data.isPaused ? 'paused' : 'running';
      }
      useDashboardStore.getState().setSimulationState(state);
    });

    this.socket.on('RUNTIME_EVENT', (event: RuntimeEvent) => {
      // Suppress live events during replay to avoid state corruption
      if (useReplayStore.getState().isReplayMode) return;
      useDashboardStore.getState().addEvent(event);
    });

    this.socket.on('EVENT_HISTORY', (events: RuntimeEvent[]) => {
      if (useReplayStore.getState().isReplayMode) return;
      useDashboardStore.getState().hydrateHistory(events);
    });
  }

  startSimulation(config: any) {
    this.socket?.emit('START_SIMULATION', config);
  }
  private backupTimer: ReturnType<typeof setInterval> | null = null;
  private static BACKUP_KEY = 'na_session_backup';
  private static BACKUP_INTERVAL = 30000; // 30 seconds

  startSessionBackup() {
    this.stopSessionBackup();
    this.backupTimer = setInterval(() => {
      const { events } = useDashboardStore.getState();
      if (events.length > 0) {
        try {
          const backup = JSON.stringify({
            timestamp: new Date().toISOString(),
            eventCount: events.length,
            events: [...events].reverse().slice(0, 500), // chronological, last 500
          });
          localStorage.setItem(SocketClient.BACKUP_KEY, backup);
        } catch { /* storage full */ }
      }
    }, SocketClient.BACKUP_INTERVAL);
  }

  stopSessionBackup() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
  }

  stopSimulation() {
    this.socket?.emit('STOP_SIMULATION');
  }

  pauseSimulation() {
    this.socket?.emit('PAUSE_SIMULATION');
  }

  resumeSimulation() {
    this.socket?.emit('RESUME_SIMULATION');
  }

  disconnect() {
    this.stopSessionBackup();
    this.socket?.disconnect();
    this.socket = null;
  }

  /** Expose connection state for diagnostics */
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  get attempts(): number {
    return this.reconnectAttempts;
  }

  /** Check if a crash recovery backup exists */
  static hasBackup(): boolean {
    return localStorage.getItem(SocketClient.BACKUP_KEY) !== null;
  }

  /** Restore backup events for replay */
  static getBackup(): { timestamp: string; eventCount: number; events: any[] } | null {
    try {
      const raw = localStorage.getItem(SocketClient.BACKUP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  /** Clear backup after successful restore */
  static clearBackup() {
    localStorage.removeItem(SocketClient.BACKUP_KEY);
  }
}

export const socketClient = new SocketClient();
