/**
 * Market monitor constants - indicator parameters, signal thresholds, retention
 */

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** RSI period, in hourly closes */
export const RSI_PERIOD = 14;

/** RSI below this value is considered oversold */
export const RSI_OVERSOLD_THRESHOLD = 30;

/** Drawdown from the 24h high (percent) that triggers a dip signal */
export const DIP_24H_THRESHOLD_PCT = 5;

/** Drawdown from the 7d high (percent) that triggers a dip signal */
export const DIP_7D_THRESHOLD_PCT = 10;

/**
 * Minimum fraction of a signal window that stored history must cover
 * before the signal is evaluated (prevents false dips on cold start).
 */
export const MIN_WINDOW_COVERAGE = 0.9;

/** Cooldown between notifications of the same signal type for the same asset */
export const SIGNAL_COOLDOWN_MS = 6 * HOUR_MS;

/** How long price history is kept */
export const PRICE_HISTORY_RETENTION_MS = 60 * DAY_MS;

/** How many hours of hourly candles to backfill on cold start (covers the 7d window) */
export const BACKFILL_HOURS = 7 * 24;

/** History gap that triggers a backfill on startup */
export const BACKFILL_TRIGGER_GAP_MS = 2 * HOUR_MS;
