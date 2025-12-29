/**
 * Command router - recursive command execution and callback routing
 */

import { Command, CallbackHandler, CallbackLookupResult } from "./types.js";
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
 * @param telegramId - User's telegram ID
 * @returns ClientResponse from the matched handler
 */
export async function routeCommand(
  cmd: Command,
  args: string[],
  telegramId: number,
): Promise<ClientResponse> {
  const { command, args: finalArgs } = findTargetCommand(cmd, args);

  // Execute this command's handler
  if (command.handler) {
    return command.handler(finalArgs, telegramId);
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
 * @param telegramId - User's telegram ID
 * @returns ClientResponseStream for progress and final result
 */
export async function* routeCommandStreaming(
  cmd: Command,
  args: string[],
  telegramId: number,
): ClientResponseStream {
  const { command, args: finalArgs } = findTargetCommand(cmd, args);

  // Prefer streaming handler if available
  if (command.streamingHandler) {
    yield* command.streamingHandler(finalArgs, telegramId);
    return;
  }

  // Fall back to regular handler
  if (command.handler) {
    const response = await command.handler(finalArgs, telegramId);
    yield { response, mode: "final" };
    return;
  }

  // No handler - return unknown subcommand message
  yield {
    response: new ClientResponse(`Unknown subcommand. Use /help for available commands.`),
    mode: "final",
  };
}

/**
 * Prefix all callbacks in command tree with their path
 * Mutates the command tree in place
 *
 * @param commands - Map of commands to prefix
 * @param prefix - Current path prefix
 */
export function prefixCallbacks(commands: Map<string, Command>, prefix = ""): void {
  for (const [name, cmd] of commands) {
    const path = prefix ? `${prefix}/${name}` : name;

    // Prefix callbacks at this level
    if (cmd.callbacks && cmd.callbacks.size > 0) {
      const prefixed = new Map<string, CallbackHandler>();
      for (const [key, handler] of cmd.callbacks) {
        prefixed.set(`${path}:${key}`, handler);
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
 * Find callback by navigating path in command tree
 * CallbackData format: "path/to/command:action"
 *
 * Tracks requiredRole through the command tree:
 * - If a command has requiredRole, that becomes the effective role
 * - Subcommands without requiredRole inherit from parent
 * - The final requiredRole is returned with the handler
 *
 * @param commands - Root commands map
 * @param callbackData - Full callback data with path
 * @returns CallbackLookupResult with handler and requiredRole if found
 */
export function findCallbackByPath(
  commands: Map<string, Command>,
  callbackData: string,
): CallbackLookupResult | undefined {
  // Parse: "wallet/export:confirm" → path=["wallet","export"], fullKey="wallet/export:confirm"
  const colonIndex = callbackData.lastIndexOf(":");
  if (colonIndex === -1) return undefined;

  const pathPart = callbackData.substring(0, colonIndex);
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

  // Get callback from target command (key includes full path)
  const handler = current?.callbacks?.get(callbackData);
  if (!handler) return undefined;

  return {
    handler,
    requiredRole: effectiveRole,
  };
}
