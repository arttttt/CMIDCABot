/**
 * User-friendly error messages for Telegram bot
 * Maps error types to localized messages without exposing technical details
 */

import { TelegramErrorType } from "../../infrastructure/shared/resilience/index.js";

/**
 * Error messages utility class
 */
export class TelegramErrorMessages {
  /**
   * User-friendly error messages (no technical details exposed)
   */
  static readonly MESSAGES: Record<TelegramErrorType, string> = {
    [TelegramErrorType.Network]: "Connection issues. Please try again.",
    [TelegramErrorType.RateLimit]: "Too many requests. Please wait a moment.",
    [TelegramErrorType.ServerError]: "Service temporarily unavailable. Please try again later.",
    [TelegramErrorType.Forbidden]: "", // No message - bot is blocked
    [TelegramErrorType.BadRequest]: "An error occurred. Please try again later.",
    [TelegramErrorType.Unknown]: "An error occurred. Please try again later.",
  };

  /**
   * Get user-friendly message for error type
   */
  static getMessage(errorType: TelegramErrorType): string {
    return this.MESSAGES[errorType];
  }

  /**
   * Check if message should be sent for this error type
   * (Forbidden means bot is blocked - no point sending)
   */
  static shouldNotifyUser(errorType: TelegramErrorType): boolean {
    return errorType !== TelegramErrorType.Forbidden;
  }
}
