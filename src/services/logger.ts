/**
 * Logger service for detailed dev mode logging
 * Only logs when NODE_ENV=development
 */

const isDev = process.env.NODE_ENV !== "production";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, component: string, message: string, data?: Record<string, unknown>): void {
  if (!isDev) return;

  const timestamp = formatTimestamp();
  const prefix = `[${level}] ${timestamp} [${component}]`;

  if (data) {
    console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export const logger = {
  debug: (component: string, message: string, data?: Record<string, unknown>) =>
    log("DEBUG", component, message, data),

  info: (component: string, message: string, data?: Record<string, unknown>) =>
    log("INFO", component, message, data),

  warn: (component: string, message: string, data?: Record<string, unknown>) =>
    log("WARN", component, message, data),

  error: (component: string, message: string, data?: Record<string, unknown>) =>
    log("ERROR", component, message, data),

  /**
   * Log a step in a multi-step operation
   */
  step: (component: string, stepNumber: number, totalSteps: number, description: string) => {
    if (!isDev) return;
    console.log(`[STEP] ${formatTimestamp()} [${component}] (${stepNumber}/${totalSteps}) ${description}`);
  },

  /**
   * Log API request/response
   */
  api: (component: string, method: string, url: string, status?: number, duration?: number) => {
    if (!isDev) return;
    const statusStr = status ? ` → ${status}` : "";
    const durationStr = duration ? ` (${duration}ms)` : "";
    console.log(`[API] ${formatTimestamp()} [${component}] ${method} ${url}${statusStr}${durationStr}`);
  },

  /**
   * Log transaction-related events
   */
  tx: (component: string, event: string, data?: Record<string, unknown>) => {
    if (!isDev) return;
    const timestamp = formatTimestamp();
    if (data) {
      console.log(`[TX] ${timestamp} [${component}] ${event}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[TX] ${timestamp} [${component}] ${event}`);
    }
  },
};
