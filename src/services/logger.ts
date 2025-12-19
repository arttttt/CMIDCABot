/**
 * Logger interface for dependency injection
 * Implementations can be swapped based on environment
 */

/**
 * List of sensitive commands that should have their arguments redacted
 * These commands may contain private keys, mnemonics, or other secrets
 */
const SENSITIVE_COMMANDS = ["/wallet import"];

/**
 * Redacts sensitive data from log messages
 * Protects: mnemonics, private keys, and arguments to sensitive commands
 */
export function redactSensitiveData(text: string): string {
  // Check if this is a sensitive command - redact everything after the command
  for (const cmd of SENSITIVE_COMMANDS) {
    if (text.toLowerCase().startsWith(cmd.toLowerCase())) {
      return `${cmd} [REDACTED]`;
    }
  }

  // Check for potential mnemonic (12 or 24 words, all lowercase letters)
  const words = text.trim().split(/\s+/);
  if ((words.length === 12 || words.length === 24) && words.every((w) => /^[a-z]+$/.test(w))) {
    return "[REDACTED MNEMONIC]";
  }

  // Check for potential base58 private key (44-88 chars, base58 alphabet)
  // Solana private keys are typically 64 or 88 characters in base58
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{44,88}$/;
  if (base58Regex.test(text.trim())) {
    return "[REDACTED KEY]";
  }

  return text;
}

export interface Logger {
  debug(component: string, message: string, data?: Record<string, unknown>): void;
  info(component: string, message: string, data?: Record<string, unknown>): void;
  warn(component: string, message: string, data?: Record<string, unknown>): void;
  error(component: string, message: string, data?: Record<string, unknown>): void;
  step(component: string, stepNumber: number, totalSteps: number, description: string): void;
  api(component: string, method: string, url: string, status?: number, duration?: number): void;
  tx(component: string, event: string, data?: Record<string, unknown>): void;
}

/**
 * Debug logger for development mode
 * Outputs detailed logs to console
 */
export class DebugLogger implements Logger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  debug(component: string, message: string, data?: Record<string, unknown>): void {
    const timestamp = this.formatTimestamp();
    if (data) {
      console.log(`[DEBUG] ${timestamp} [${component}] ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[DEBUG] ${timestamp} [${component}] ${message}`);
    }
  }

  info(component: string, message: string, data?: Record<string, unknown>): void {
    const timestamp = this.formatTimestamp();
    if (data) {
      console.log(`[INFO] ${timestamp} [${component}] ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[INFO] ${timestamp} [${component}] ${message}`);
    }
  }

  warn(component: string, message: string, data?: Record<string, unknown>): void {
    const timestamp = this.formatTimestamp();
    if (data) {
      console.log(`[WARN] ${timestamp} [${component}] ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[WARN] ${timestamp} [${component}] ${message}`);
    }
  }

  error(component: string, message: string, data?: Record<string, unknown>): void {
    const timestamp = this.formatTimestamp();
    if (data) {
      console.error(`[ERROR] ${timestamp} [${component}] ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.error(`[ERROR] ${timestamp} [${component}] ${message}`);
    }
  }

  step(component: string, stepNumber: number, totalSteps: number, description: string): void {
    const timestamp = this.formatTimestamp();
    console.log(`[STEP] ${timestamp} [${component}] (${stepNumber}/${totalSteps}) ${description}`);
  }

  api(component: string, method: string, url: string, status?: number, duration?: number): void {
    const timestamp = this.formatTimestamp();
    const statusStr = status ? ` → ${status}` : "";
    const durationStr = duration ? ` (${duration}ms)` : "";
    console.log(`[API] ${timestamp} [${component}] ${method} ${url}${statusStr}${durationStr}`);
  }

  tx(component: string, event: string, data?: Record<string, unknown>): void {
    const timestamp = this.formatTimestamp();
    if (data) {
      console.log(`[TX] ${timestamp} [${component}] ${event}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[TX] ${timestamp} [${component}] ${event}`);
    }
  }
}

/**
 * No-op logger for production mode
 * Does nothing - can be replaced with analytics service later
 */
export class NoOpLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  step(): void {}
  api(): void {}
  tx(): void {}
}

/**
 * Global logger instance
 * Set via setLogger() at application startup
 */
let globalLogger: Logger = new NoOpLogger();

export function setLogger(logger: Logger): void {
  globalLogger = logger;
}

export function getLogger(): Logger {
  return globalLogger;
}

/**
 * Convenience export for direct usage
 * Uses the global logger instance
 */
export const logger: Logger = {
  debug: (...args) => globalLogger.debug(...args),
  info: (...args) => globalLogger.info(...args),
  warn: (...args) => globalLogger.warn(...args),
  error: (...args) => globalLogger.error(...args),
  step: (...args) => globalLogger.step(...args),
  api: (...args) => globalLogger.api(...args),
  tx: (...args) => globalLogger.tx(...args),
};
