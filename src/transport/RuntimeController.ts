import { Server as SocketIOServer } from 'socket.io';
import * as http from 'http';
import { Runtime } from '../engine/Runtime';
import { ChessPlugin } from '../plugins/chess/index';
import { AgentConfig, LogLevel } from '../core/types';
import { Logger } from '../core/logger';
import { DEFAULT_CONFIG } from '../core/engine';
import { spawn } from 'child_process';
import * as path from 'path';

export class RuntimeController {
  private io: SocketIOServer;
  private server: http.Server;
  private runtime: Runtime | null = null;
  private isPaused: boolean = false;
  private logger: Logger;

  constructor(port: number) {
    this.logger = new Logger(LogLevel.DEBUG, `${process.cwd()}/logs`);

    if (!(globalThis as any).__NEURAL_SOCKET_SERVER__) {
      console.log('[Socket] Initializing Runtime Controller');
      this.server = http.createServer();
      this.io = new SocketIOServer(this.server, { cors: { origin: '*' } });
      
      this.server.on('error', (e: any) => {
        if (e.code === 'EADDRINUSE') {
          console.error(`[Socket] Port ${port} is already in use. Offline mode or use existing instance.`);
        } else {
          console.error('[Socket] Server error:', e);
        }
      });

      this.server.listen(port, () => {
        console.log(`[Backend] Socket.IO Headless Service running on port ${port}`);
        
        // Auto-start electron in development if not already running
        if (process.env.NODE_ENV !== 'production' && !process.env.ELECTRON_SPAWNED) {
          console.log('[Backend] Spawning Electron app...');
          const electronPath = require('electron') as unknown as string;
          const child = spawn(electronPath, [path.join(process.cwd(), 'electron-main.js')], {
            env: { ...process.env, ELECTRON_SPAWNED: '1' },
            stdio: 'inherit'
          });
          
          child.on('close', () => {
            console.log('[Backend] Electron closed, exiting server...');
            process.exit(0);
          });
        }
      });
      (globalThis as any).__NEURAL_SOCKET_SERVER__ = this.io;
    } else {
      console.log('[Socket] Reusing existing headless service');
      this.io = (globalThis as any).__NEURAL_SOCKET_SERVER__;
      // We don't have the http.Server reference but that's fine, it's already listening.
      this.server = {} as any; 
    }

    this.setupListeners();
  }

  private setupListeners() {
    if ((globalThis as any).__NEURAL_SOCKET_LISTENER_ADDED__) return;

    this.io.on('connection', (socket) => {
      this.logger.info(`[Socket.IO] UI Dashboard connected: ${socket.id}`);

      // Sync status
      socket.emit('status', { 
        isRunning: !!this.runtime,
        isPaused: this.isPaused
      });
      if (this.runtime) {
        socket.emit('EVENT_HISTORY', this.runtime.getEventBus().getStore().getHistory());
      }

      socket.on('START_SIMULATION', (configData: any) => {
        if (this.runtime) {
          this.logger.warn('Simulation already running');
          socket.emit('error', 'Simulation already running');
          return;
        }

        try {
          const { agent1, agent2, timeoutMs } = configData;
          const agents: AgentConfig[] = [
            { index: 0, name: agent1.name, apiKey: agent1.apiKey, baseUrl: agent1.baseUrl, model: agent1.model },
            { index: 1, name: agent2.name, apiKey: agent2.apiKey, baseUrl: agent2.baseUrl, model: agent2.model }
          ];

          const config = { ...DEFAULT_CONFIG, timeoutMs: timeoutMs || 120000 };
          const chessPlugin = new ChessPlugin() as any;

          this.runtime = new Runtime(chessPlugin, agents, config, this.logger, process.cwd());
          const events = this.runtime.getEventBus();

          events.subscribeAll((payload) => {
            this.io.emit('RUNTIME_EVENT', payload);
          });

          this.isPaused = false;
          this.runtime.start();
          this.logger.info('Simulation started via dashboard');
          this.io.emit('status', { isRunning: true, isPaused: false });

        } catch (err: any) {
          this.logger.error(`Failed to start simulation: ${err.message}`);
          socket.emit('error', err.message);
        }
      });

      socket.on('STOP_SIMULATION', () => {
        if (this.runtime) {
          this.runtime.stop();
          this.runtime = null;
          this.isPaused = false;
          this.io.emit('status', { isRunning: false, isPaused: false });
          this.logger.info('Simulation stopped via dashboard');
        }
      });

      socket.on('PAUSE_SIMULATION', () => {
        if (this.runtime && !this.isPaused) {
          this.runtime.stop(); 
          this.isPaused = true;
          this.io.emit('status', { isRunning: true, isPaused: true });
          this.logger.info('Simulation paused via dashboard');
        }
      });

      socket.on('RESUME_SIMULATION', () => {
        if (this.runtime && this.isPaused) {
          this.isPaused = false;
          this.runtime.start();
          this.io.emit('status', { isRunning: true, isPaused: false });
          this.logger.info('Simulation resumed via dashboard');
        }
      });

      socket.on('disconnect', () => {
        this.logger.info(`[Socket.IO] UI Dashboard disconnected: ${socket.id}`);
      });
    });

    (globalThis as any).__NEURAL_SOCKET_LISTENER_ADDED__ = true;
  }
}
