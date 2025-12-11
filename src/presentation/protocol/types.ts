/**
 * Presentation protocol types - unified UI contract
 * This is internal to the presentation layer
 */

/**
 * UI Button for inline keyboards
 */
export interface UIButton {
  text: string;
  callbackData: string;
}

/**
 * Unified UI response format
 */
export interface UIResponse {
  text: string;
  buttons?: UIButton[][];
}

/**
 * Message context from adapter
 */
export interface UIMessageContext {
  userId: string;
  telegramId: number;
  username?: string;
  text: string;
}

/**
 * Callback context from adapter
 */
export interface UICallbackContext {
  telegramId: number;
  callbackData: string;
}

/**
 * Command definition for registration
 */
export interface UICommand {
  name: string;
  description: string;
}
