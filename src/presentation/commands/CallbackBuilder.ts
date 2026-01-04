/**
 * CallbackBuilder - constructs callback data strings for Telegram buttons
 *
 * Centralizes callback data format to ensure consistency between
 * callback registration (in handlers) and callback generation (in formatters).
 *
 * Format: "path:action:param1:param2:..."
 */

export class CallbackBuilder {
  /**
   * Build callback data string from path, action, and optional parameters
   *
   * @param path - Command path (e.g., "portfolio/buy")
   * @param action - Callback action (e.g., "confirm", "cancel")
   * @param params - Optional parameters to include
   * @returns Formatted callback data string
   *
   * @example
   * CallbackBuilder.build("portfolio/buy", "confirm", "abc123")
   * // Returns: "portfolio/buy:confirm:abc123"
   *
   * @example
   * CallbackBuilder.build("swap/execute", "cancel")
   * // Returns: "swap/execute:cancel"
   */
  static build(path: string, action: string, ...params: string[]): string {
    const parts = [path, action, ...params];
    return parts.join(":");
  }
}
