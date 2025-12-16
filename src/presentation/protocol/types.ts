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
  /** If true, the adapter should delete the user's original message (for sensitive data like private keys) */
  deleteUserMessage?: boolean;
  /** If set, the bot's response message will be auto-deleted after this many seconds */
  autoDeleteSeconds?: number;
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
