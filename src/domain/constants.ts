/**
 * Domain constants
 */

/**
 * Minimum SOL balance required for transaction fees.
 * Transactions will fail if wallet has less than this amount.
 */
export const MIN_SOL_AMOUNT = 0.01;

/**
 * Minimum USDC amount for purchases/swaps.
 * Amounts below this threshold are rejected.
 */
export const MIN_USDC_AMOUNT = 0.01;

/**
 * Maximum USDC amount for purchases/swaps.
 * Amounts above this threshold are rejected.
 */
export const MAX_USDC_AMOUNT = 50;

/**
 * Maximum allowed price impact in basis points (bps).
 * Swaps with price impact above this threshold are rejected.
 * 50 bps = 0.5%
 */
export const MAX_PRICE_IMPACT_BPS = 50;
