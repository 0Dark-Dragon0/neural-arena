// ================================================================
// Neural Arena — Logger
// ================================================================
// Structured logging with automatic API key sanitization.
// Keys, tokens, secrets, and passwords are NEVER logged.
// ================================================================

import { LogLevel } from './types';
import * as fs from 'fs';
import * as path from 'path';

export class Logger {
  private level: LogLevel;
  private logFile: string | null;

  constructor(level: LogLevel = LogLevel.INFO, logDir?: string) {
    this.level = level;
    if (logDir) {
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      this.logFile = path.join(logDir, `neural-arena-${Date.now()}.log`);
    } else {
      this.logFile = null;
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (level < this.level) return;

    const sanitized = data ? this.sanitize(data) : undefined;
    const entry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      ...(sanitized && { data: sanitized }),
    };

    // Console output with color-coded prefixes
    const prefix = this.getPrefix(level);
    const dataStr = sanitized ? ` ${JSON.stringify(sanitized)}` : '';
    console.log(`${prefix} ${message}${dataStr}`);

    // Append to log file if configured
    if (this.logFile) {
      fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n');
    }
  }

  private getPrefix(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '\x1b[90m[DEBUG]\x1b[0m';
      case LogLevel.INFO:  return '\x1b[36m[INFO]\x1b[0m ';
      case LogLevel.WARN:  return '\x1b[33m[WARN]\x1b[0m ';
      case LogLevel.ERROR: return '\x1b[31m[ERROR]\x1b[0m';
    }
  }

  /**
   * Sanitize data to ensure API keys and secrets NEVER appear in logs.
   * Any key matching sensitive patterns is replaced with [REDACTED].
   */
  private sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (/key|token|secret|password|auth|bearer/i.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = value.substring(0, 500) + '...[truncated]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitize(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}
