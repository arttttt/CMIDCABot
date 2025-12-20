/**
 * Logger interface for dependency injection
 * Implementations can be swapped based on environment
 */

/**
 * Utility class for masking and redacting sensitive data in logs
 */
export class LogSanitizer {
  private static readonly SENSITIVE_COMMANDS = ["/wallet import"];

  private static readonly SENSITIVE_FIELDS = new Set([
    "telegramId",
    "telegram_id",
    "userId",
    "user_id",
    "ownerId",
    "owner_id",
    "ownerTelegramId",
    "targetTelegramId",
    "addedBy",
    "added_by",
  ]);

  /**
   * Masks a numeric ID, showing only first 2 and last 2 digits
   * Example: 123456789 -> "12***89"
   */
  private static maskNumericId(value: number | string): string {
    const str = String(value);
    if (str.length <= 4) {
      return "***";
    }
    return `${str.slice(0, 2)}***${str.slice(-2)}`;
  }

  /**
   * Recursively masks sensitive fields in a data object
   */
  static maskFields(data: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (this.SENSITIVE_FIELDS.has(key)) {
        if (typeof value === "number" || typeof value === "string") {
          masked[key] = this.maskNumericId(value);
        } else if (value === null || value === undefined) {
          masked[key] = value;
        } else {
          masked[key] = "[REDACTED]";
        }
      } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        masked[key] = this.maskFields(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        masked[key] = value.map((item) =>
          item !== null && typeof item === "object"
            ? this.maskFields(item as Record<string, unknown>)
            : item,
        );
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  /**
   * Redacts sensitive data from log messages
   * Protects: mnemonics, private keys, and arguments to sensitive commands
   */
  static redactText(text: string): string {
    // Check if this is a sensitive command - redact everything after the command
    for (const cmd of this.SENSITIVE_COMMANDS) {
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
 * Outputs detailed logs to console without masking for full debugging
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
