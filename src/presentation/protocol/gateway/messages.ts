/**
 * Gateway response messages
 *
 * Constants for user-facing messages to ensure consistency.
 */

export const GatewayMessages = {
  UNKNOWN_COMMAND: "Unknown command. Use /help to see available commands.",
  UNKNOWN_ACTION: "Unknown action.",
  UNKNOWN_REQUEST_TYPE: "Unknown request type",
  HTTP_NOT_IMPLEMENTED: "HTTP handler not implemented",
} as const;
