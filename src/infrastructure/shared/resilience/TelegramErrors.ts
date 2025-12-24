/**
 * Telegram error classification utilities
 * Classifies errors for user-friendly messaging without direct grammy dependency
 */

import { isRateLimitError } from "./Retry.js";

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
 * Check if error looks like HttpError from grammY
 * HttpError extends Error and has name "HttpError"
 */
function isHttpErrorLike(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === "HttpError"
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
      return this.classifyByMessage(error);
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
  private static classifyByMessage(error: Error): TelegramErrorType {
    const lowerMessage = error.message.toLowerCase();

    // Check for network errors
    for (const pattern of NETWORK_ERROR_PATTERNS) {
      if (lowerMessage.includes(pattern)) {
        return TelegramErrorType.Network;
      }
    }

    // Reuse existing rate limit check for consistency
    if (isRateLimitError(error)) {
      return TelegramErrorType.RateLimit;
    }

    return TelegramErrorType.Unknown;
  }
}
