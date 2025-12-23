/**
 * MessageSender - port for sending messages to users
 *
 * Abstraction for sending notifications from non-Telegram contexts
 * (e.g., HTTP handlers) back to Telegram users.
 */

import type { UIResponse } from "../protocol/types.js";

export interface MessageSender {
  /**
   * Send a message to a user
   *
   * @param telegramId - Target user's Telegram ID
   * @param response - UI response to send
   */
  send(telegramId: number, response: UIResponse): Promise<void>;
}
