/**
 * Precision utilities for cryptocurrency amount conversions.
 *
 * Uses decimal.js to avoid floating-point precision loss when converting
 * between human-readable amounts (e.g., 1.5 SOL) and raw blockchain units
 * (e.g., 1500000000 lamports).
 *
 * Problem with Number:
 *   Number(999999999123456789) → 999999999123456800 (precision loss)
 *
 * Solution with Decimal:
 *   new Decimal("999999999123456789") → exact value preserved
 */

import { Decimal } from "decimal.js";

// Configure Decimal for maximum precision
Decimal.set({
  precision: 50, // 50 significant digits (more than enough for any crypto)
  rounding: Decimal.ROUND_DOWN, // Always round down for safety (never overspend)
});

/**
 * Convert human-readable amount to raw blockchain units.
 *
 * @param humanAmount - Amount in human-readable format (e.g., 1.5 SOL)
 * @param decimals - Number of decimal places for the token (e.g., 9 for SOL)
 * @returns Raw amount as string (e.g., "1500000000" lamports)
 *
 * @example
 * toRawAmount(1.5, 9) → "1500000000"
 * toRawAmount("0.000001", 6) → "1"
 */
export function toRawAmount(
  humanAmount: Decimal | number | string,
  decimals: number,
): string {
  const amount = new Decimal(humanAmount);
  const multiplier = new Decimal(10).pow(decimals);
  const raw = amount.mul(multiplier).floor(); // Round down for safety
  return raw.toFixed(0); // Return as integer string
}

/**
 * Convert raw blockchain units to human-readable amount.
 *
 * @param rawAmount - Amount in raw units (e.g., "1500000000" lamports)
 * @param decimals - Number of decimal places for the token (e.g., 9 for SOL)
 * @returns Decimal representing human-readable amount
 *
 * @example
 * toHumanAmount("1500000000", 9) → Decimal(1.5)
 * toHumanAmount("1", 6) → Decimal(0.000001)
 */
export function toHumanAmount(
  rawAmount: string | bigint,
  decimals: number,
): Decimal {
  const raw = new Decimal(rawAmount.toString());
  const divisor = new Decimal(10).pow(decimals);
  return raw.div(divisor);
}

/**
 * Convert human-readable amount to number for display purposes.
 *
 * WARNING: Only use this for final display/logging. Internal calculations
 * should use Decimal to maintain precision.
 *
 * @param rawAmount - Amount in raw units
 * @param decimals - Number of decimal places for the token
 * @returns JavaScript number (may lose precision for very large values)
 */
export function toHumanAmountNumber(
  rawAmount: string | bigint,
  decimals: number,
): number {
  return toHumanAmount(rawAmount, decimals).toNumber();
}

/**
 * Safely divide two amounts (e.g., USDC amount / asset price).
 *
 * @param dividend - Amount to divide
 * @param divisor - Amount to divide by
 * @returns Result as Decimal
 *
 * @example
 * divideAmount(100, 50000) → Decimal(0.002) // $100 / $50000 BTC price
 */
export function divideAmount(
  dividend: Decimal | number | string,
  divisor: Decimal | number | string,
): Decimal {
  const d1 = new Decimal(dividend);
  const d2 = new Decimal(divisor);
  return d1.div(d2);
}

/**
 * Safely multiply two amounts.
 *
 * @param a - First operand
 * @param b - Second operand
 * @returns Result as Decimal
 */
export function multiplyAmount(
  a: Decimal | number | string,
  b: Decimal | number | string,
): Decimal {
  return new Decimal(a).mul(new Decimal(b));
}

/**
 * Create a Decimal from various input types.
 * Convenience wrapper for consistent Decimal creation.
 *
 * @param value - Value to convert
 * @returns Decimal instance
 */
export function toDecimal(value: Decimal | number | string | bigint): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value.toString());
}

// Re-export Decimal class for use in other modules
export { Decimal };
