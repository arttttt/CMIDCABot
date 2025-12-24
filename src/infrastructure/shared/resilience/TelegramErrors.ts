/**
 * Telegram error classification utilities
 * Classifies errors for user-friendly messaging without direct grammy dependency
 */

/**
 * Classified error types for Telegram bot errors
 */
export enum TelegramErrorType {
  Network = "network",
  RateLimit = "rate_limit",
  ServerError = "server_error",
  Forbidden = "forbidden",
  BadRequest = "bad_request",
  Unknown = "unknown",
}

/**
 * User-friendly error messages (no technical details exposed)
 */
export const TELEGRAM_ERROR_MESSAGES: Record<TelegramErrorType, string> = {
  [TelegramErrorType.Network]: "Connection issues. Please try again.",
  [TelegramErrorType.RateLimit]: "Too many requests. Please wait a moment.",
  [TelegramErrorType.ServerError]: "Service temporarily unavailable. Please try again later.",
  [TelegramErrorType.Forbidden]: "", // No message - bot is blocked
  [TelegramErrorType.BadRequest]: "An error occurred. Please try again later.",
  [TelegramErrorType.Unknown]: "An error occurred. Please try again later.",
};

/**
 * Network error indicators in error messages
 */
const NETWORK_ERROR_PATTERNS = [
  "etimedout",
  "econnreset",
  "econnrefused",
  "enotfound",
  "enetunreach",
  "socket hang up",
  "network",
  "fetch failed",
];

/**
 * Duck-typed interface for GrammyError-like objects
 * GrammyError has: error_code (HTTP status), description, method
 */
interface GrammyErrorLike {
  error_code: number;
}

/**
 * Duck-typed interface for HttpError-like objects
 * HttpError has: error (original error)
 */
interface HttpErrorLike {
  error: unknown;
}

/**
 * Check if error looks like GrammyError (has error_code property)
 */
function isGrammyErrorLike(error: unknown): error is GrammyErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "error_code" in error &&
    typeof (error as GrammyErrorLike).error_code === "number"
  );
}

/**
 * Check if error looks like HttpError (has error property but no error_code)
 */
function isHttpErrorLike(error: unknown): error is HttpErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    !("error_code" in error)
  );
}

/**
 * Classifier for Telegram/grammY errors
 */
export class TelegramErrorClassifier {
  /**
   * Classify an error into a TelegramErrorType
   */
  static classify(error: unknown): TelegramErrorType {
    // GrammyError-like - has error_code (HTTP status)
    if (isGrammyErrorLike(error)) {
      return this.classifyByStatusCode(error.error_code);
    }

    // HttpError-like - network-level errors
    if (isHttpErrorLike(error)) {
      return TelegramErrorType.Network;
    }

    // Standard Error - check message for patterns
    if (error instanceof Error) {
      return this.classifyByMessage(error.message);
    }

    return TelegramErrorType.Unknown;
  }

  /**
   * Classify by HTTP status code
   */
  private static classifyByStatusCode(code: number): TelegramErrorType {
    if (code === 429) {
      return TelegramErrorType.RateLimit;
    }

    if (code === 403) {
      return TelegramErrorType.Forbidden;
    }

    if (code === 400) {
      return TelegramErrorType.BadRequest;
    }

    if (code >= 500 && code < 600) {
      return TelegramErrorType.ServerError;
    }

    return TelegramErrorType.Unknown;
  }

  /**
   * Classify by error message content
   */
  private static classifyByMessage(message: string): TelegramErrorType {
    const lowerMessage = message.toLowerCase();

    // Check for network errors
    for (const pattern of NETWORK_ERROR_PATTERNS) {
      if (lowerMessage.includes(pattern)) {
        return TelegramErrorType.Network;
      }
    }

    // Check for rate limit
    if (lowerMessage.includes("429") || lowerMessage.includes("too many requests")) {
      return TelegramErrorType.RateLimit;
    }

    return TelegramErrorType.Unknown;
  }

  /**
   * Get user-friendly message for error type
   */
  static getMessage(errorType: TelegramErrorType): string {
    return TELEGRAM_ERROR_MESSAGES[errorType];
  }

  /**
   * Check if message should be sent for this error type
   * (Forbidden means bot is blocked - no point sending)
   */
  static shouldNotifyUser(errorType: TelegramErrorType): boolean {
    return errorType !== TelegramErrorType.Forbidden;
  }
}
