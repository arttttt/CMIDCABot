/**
 * Command router - recursive command execution and callback routing
 */

import { Command, CallbackDefinition, CallbackLookupResult, CommandExecutionContext } from "./types.js";
import type { UserRole } from "../../domain/models/AuthorizedUser.js";
import { ClientResponse, ClientResponseStream } from "../protocol/types.js";

/**
 * Result of finding a routed command
 */
export interface RoutedCommand {
  command: Command;
  args: string[];
}

/**
 * Find target command by navigating the command tree
 *
 * @param cmd - Root command to start from
 * @param args - Arguments to parse
 * @returns RoutedCommand with target command and remaining args
 */
export function findTargetCommand(cmd: Command, args: string[]): RoutedCommand {
  const [first, ...rest] = args;

  // Try to find a subcommand
  if (first && cmd.subcommands) {
    const sub = cmd.subcommands.get(first.toLowerCase());
    if (sub) {
      return findTargetCommand(sub, rest);
    }
  }

  // No subcommand found - this is the target
  return { command: cmd, args };
}

/**
 * Route command execution through the command tree
 *
 * @param cmd - Command to execute
 * @param args - Remaining arguments
 * @param ctx - Command execution context
 * @returns ClientResponse from the matched handler
 */
export async function routeCommand(
  cmd: Command,
  args: string[],
  ctx: CommandExecutionContext,
): Promise<ClientResponse> {
  const { command, args: finalArgs } = findTargetCommand(cmd, args);

  // Execute this command's handler
  if (command.handler) {
    return command.handler(finalArgs, ctx);
  }

  // No handler - return unknown subcommand message
  return new ClientResponse(`Unknown subcommand. Use /help for available commands.`);
}

/**
 * Route command with streaming support
 *
 * If the target command has a streamingHandler, uses it.
 * Otherwise falls back to regular handler wrapped in a single-item stream.
 *
 * @param cmd - Command to execute
 * @param args - Remaining arguments
 * @param ctx - Command execution context
 * @returns ClientResponseStream for progress and final result
 */
export async function* routeCommandStreaming(
  cmd: Command,
  args: string[],
  ctx: CommandExecutionContext,
): ClientResponseStream {
  const { command, args: finalArgs } = findTargetCommand(cmd, args);

  // Prefer streaming handler if available
  if (command.streamingHandler) {
    yield* command.streamingHandler(finalArgs, ctx);
    return;
  }

  // Fall back to regular handler
  if (command.handler) {
    const response = await command.handler(finalArgs, ctx);
    yield { response, mode: "final" };
    return;
  }

  // No handler - return unknown subcommand message
  yield {
    response: new ClientResponse(`Unknown subcommand. Use /help for available commands.`),
    mode: "final",
  };
}

// Telegram callback data limit
const CALLBACK_MAX_LENGTH = 64;

/**
 * Calculate the maximum callback data length for a callback definition
 *
 * Format: "path:action" or "path:action:param"
 * @param path - Full path including action (e.g., "portfolio/buy:confirm")
 * @param definition - Callback definition with optional params
 * @returns Maximum possible length of callback data
 */
function calculateCallbackLength(path: string, definition: CallbackDefinition): number {
  let length = path.length;

  if (definition.params && definition.params.length > 0) {
    // Add colon separator and max length of each param
    for (const param of definition.params) {
      length += 1 + param.maxLength; // ":" + param value
    }
  }

  return length;
}

/**
 * Prefix all callbacks in command tree with their path
 * Mutates the command tree in place
 *
 * Validates that all callback data lengths are within Telegram's 64-byte limit.
 * Throws an error at startup if any callback would exceed the limit.
 *
 * @param commands - Map of commands to prefix
 * @param prefix - Current path prefix
 * @throws Error if any callback data would exceed 64 bytes
 */
export function prefixCallbacks(commands: Map<string, Command>, prefix = ""): void {
  for (const [name, cmd] of commands) {
    const path = prefix ? `${prefix}/${name}` : name;

    // Prefix callbacks at this level
    if (cmd.callbacks && cmd.callbacks.size > 0) {
      const prefixed = new Map<string, CallbackDefinition>();
      for (const [key, definition] of cmd.callbacks) {
        const fullPath = `${path}:${key}`;
        const maxLength = calculateCallbackLength(fullPath, definition);

        if (maxLength > CALLBACK_MAX_LENGTH) {
          throw new Error(
            `Callback "${fullPath}" exceeds max length: ${maxLength} > ${CALLBACK_MAX_LENGTH}. ` +
            `Reduce path length or parameter maxLength.`,
          );
        }

        prefixed.set(fullPath, definition);
      }
      cmd.callbacks = prefixed;
    }

    // Recursively prefix subcommands
    if (cmd.subcommands) {
      prefixCallbacks(cmd.subcommands, path);
    }
  }
}

/**
 * Parse callback data into base key and optional parameter
 *
 * Format: "path/to/command:action" or "path/to/command:action:param"
 * Examples:
 * - "portfolio/buy:confirm" → { baseKey: "portfolio/buy:confirm", param: undefined }
 * - "portfolio/buy:confirm:abc123" → { baseKey: "portfolio/buy:confirm", param: "abc123" }
 */
export function parseCallbackData(callbackData: string): { baseKey: string; param?: string } {
  // Find first colon (separates path from action)
  const firstColonIndex = callbackData.indexOf(":");
  if (firstColonIndex === -1) {
    return { baseKey: callbackData };
  }

  // Check if there's a second colon (parameter)
  const secondColonIndex = callbackData.indexOf(":", firstColonIndex + 1);
  if (secondColonIndex === -1) {
    // No parameter
    return { baseKey: callbackData };
  }

  // Has parameter
  const baseKey = callbackData.substring(0, secondColonIndex);
  const param = callbackData.substring(secondColonIndex + 1);

  return { baseKey, param };
}

/**
 * Find callback by navigating path in command tree
 * CallbackData format: "path/to/command:action" or "path/to/command:action:param"
 *
 * Tracks requiredRole through the command tree:
 * - If a command has requiredRole, that becomes the effective role
 * - Subcommands without requiredRole inherit from parent
 * - The final requiredRole is returned with the handler
 *
 * @param commands - Root commands map
 * @param callbackData - Full callback data with path
 * @returns CallbackLookupResult with handler, requiredRole, and optional param if found
 */
export function findCallbackByPath(
  commands: Map<string, Command>,
  callbackData: string,
): CallbackLookupResult | undefined {
  // Parse callback data to extract base key and optional parameter
  const { baseKey, param } = parseCallbackData(callbackData);

  // Parse: "wallet/export:confirm" → path=["wallet","export"], fullKey="wallet/export:confirm"
  const colonIndex = baseKey.lastIndexOf(":");
  if (colonIndex === -1) return undefined;

  const pathPart = baseKey.substring(0, colonIndex);
  const segments = pathPart.split("/");

  // Navigate to the target command, tracking requiredRole
  let current: Command | undefined;
  let currentCommands = commands;
  let effectiveRole: UserRole | undefined;

  for (const segment of segments) {
    current = currentCommands.get(segment);
    if (!current) return undefined;

    // Track required role - inherit from parent if not specified
    if (current.requiredRole) {
      effectiveRole = current.requiredRole;
    }

    currentCommands = current.subcommands ?? new Map();
  }

  // Get callback definition from target command (key includes full path)
  const definition = current?.callbacks?.get(baseKey);
  if (!definition) return undefined;

  return {
    handler: definition.handler,
    requiredRole: effectiveRole,
    param,
  };
}
