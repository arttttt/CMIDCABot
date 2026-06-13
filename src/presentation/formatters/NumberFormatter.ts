/**
 * NumberFormatter - shared numeric formatting for UI output
 *
 * Single source of truth for how amounts, prices and percentages are
 * rendered across formatters. Asset-specific formatting (e.g. per-symbol
 * balance precision) and signed change formatting live with their owners.
 */

export class NumberFormatter {
  /**
   * Format a token amount with precision scaled to its magnitude.
   */
  static formatAmount(amount: number): string {
    if (amount >= 1000) {
      return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (amount >= 1) {
      return amount.toFixed(4);
    }
    if (amount >= 0.0001) {
      return amount.toFixed(6);
    }
    return amount.toFixed(8);
  }

  /**
   * Format a USD price (two decimals, thousands separators above 1000).
   */
  static formatPrice(price: number): string {
    if (price >= 1000) {
      return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toFixed(2);
  }

  /**
   * Format a percentage; magnitudes below 0.01% collapse to "<0.01%".
   */
  static formatPercent(pct: number): string {
    if (Math.abs(pct) < 0.01) {
      return "<0.01%";
    }
    return `${pct.toFixed(2)}%`;
  }
}
