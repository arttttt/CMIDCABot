/**
 * Presentation protocol types - unified client response contract
 * This is internal to the presentation layer
 */

/**
 * Button for inline keyboards
 */
export interface ClientButton {
  text: string;
  /** Callback data for button press (mutually exclusive with url) */
  callbackData?: string;
  /** URL to open when button is pressed (mutually exclusive with callbackData) */
  url?: string;
}

/**
 * Unified client response format
 */
export interface ClientResponse {
  text: string;
  buttons?: ClientButton[][];
  /** If true, the adapter should delete the user's original message (for sensitive data like private keys) */
  deleteUserMessage?: boolean;
}

/**
 * Streaming response item with display mode
 */
export interface StreamItem {
  response: ClientResponse;
  /**
   * How to display this response:
   * - 'edit': Update the existing message (for status updates)
   * - 'new': Send a new message (for items with useful data)
   * - 'final': The final response after operation completes
   */
  mode: "edit" | "new" | "final";
}

/**
 * Streaming response - AsyncGenerator yielding client updates
 */
export type ClientResponseStream = AsyncGenerator<StreamItem, void, undefined>;

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
