/**
 * Presentation protocol types - unified UI contract
 * This is internal to the presentation layer
 */

/**
 * UI Button for inline keyboards
 */
export interface UIButton {
  text: string;
  /** Callback data for button press (mutually exclusive with url) */
  callbackData?: string;
  /** URL to open when button is pressed (mutually exclusive with callbackData) */
  url?: string;
}

/**
 * Unified UI response format
 */
export interface UIResponse {
  text: string;
  buttons?: UIButton[][];
  /** If true, the adapter should delete the user's original message (for sensitive data like private keys) */
  deleteUserMessage?: boolean;
}

/**
 * Streaming response item with display mode
 */
export interface UIStreamItem {
  response: UIResponse;
  /**
   * How to display this response:
   * - 'edit': Update the existing message (for status updates)
   * - 'new': Send a new message (for items with useful data)
   * - 'final': The final response after operation completes
   */
  mode: "edit" | "new" | "final";
}

/**
 * Streaming response - AsyncGenerator yielding UI updates
 */
export type UIResponseStream = AsyncGenerator<UIStreamItem, void, undefined>;

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
