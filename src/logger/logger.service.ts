import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Custom Logger Service
 * - Menulis log ke console DAN file
 * - Format: [timestamp] [level] [context] message
 * - Auto-rotate log file per hari
 */
@Injectable()
export class AppLoggerService implements LoggerService {
  private logDir: string;

  constructor(private configService: ConfigService) {
    this.logDir = this.configService.get<string>('LOG_DIR', './logs');
    this.ensureLogDir();
  }

  log(message: string, context?: string): void {
    this.writeLog('INFO', message, context);
  }

  error(message: string, trace?: string, context?: string): void {
    this.writeLog('ERROR', message, context);
    if (trace) {
      this.writeLog('ERROR', `Stack: ${trace}`, context);
    }
  }

  warn(message: string, context?: string): void {
    this.writeLog('WARN', message, context);
  }

  debug(message: string, context?: string): void {
    this.writeLog('DEBUG', message, context);
  }

  verbose(message: string, context?: string): void {
    this.writeLog('VERBOSE', message, context);
  }

  private writeLog(level: string, message: string, context?: string): void {
    const timestamp = new Date().toISOString();
    const ctx = context ? `[${context}]` : '';
    const line = `[${timestamp}] [${level}] ${ctx} ${message}`;

    // Console output dengan warna
    const colorMap: Record<string, string> = {
      INFO: '\x1b[32m',    // green
      ERROR: '\x1b[31m',   // red
      WARN: '\x1b[33m',    // yellow
      DEBUG: '\x1b[36m',   // cyan
      VERBOSE: '\x1b[35m', // magenta
    };
    const reset = '\x1b[0m';
    const color = colorMap[level] || '';
    console.log(`${color}${line}${reset}`);

    // File output
    try {
      const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const filePath = path.join(this.logDir, `wa-sent-${dateStr}.log`);
      fs.appendFileSync(filePath, line + '\n', 'utf-8');
    } catch {
      // Jangan throw error di logger
    }
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }
}
