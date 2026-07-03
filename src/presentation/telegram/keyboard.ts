/**
 * Telegram keyboard mapping - ClientResponse buttons to grammY InlineKeyboard
 */

import { InlineKeyboard } from "grammy";
import type { ClientResponse } from "../protocol/types.js";

export class TelegramKeyboard {
  /**
   * Build an inline keyboard from response buttons, if any
   */
  static from(response: ClientResponse): InlineKeyboard | undefined {
    if (!response.buttons?.length) return undefined;

    const keyboard = new InlineKeyboard();
    for (const row of response.buttons) {
      for (const button of row) {
        if (button.url) {
          // URL button - opens external link
          keyboard.url(button.text, button.url);
        } else if (button.callbackData) {
          // Callback button - triggers bot callback
          keyboard.text(button.text, button.callbackData);
        }
      }
      keyboard.row();
    }
    return keyboard;
  }
}
