/**
 * Command router - recursive command execution and callback routing
 */

import { Command, CallbackHandler } from "./types.js";
import { UIResponse } from "../protocol/types.js";

/**
 * Route command execution through the command tree
 *
 * @param cmd - Command to execute
 * @param args - Remaining arguments
 * @param telegramId - User's telegram ID
 * @returns UIResponse from the matched handler
 */
export async function routeCommand(
  cmd: Command,
  args: string[],
  telegramId: number,
): Promise<UIResponse> {
  const [first, ...rest] = args;

  // Try to find a subcommand
  if (first && cmd.subcommands) {
    const sub = cmd.subcommands.get(first.toLowerCase());
    if (sub) {
      return routeCommand(sub, rest, telegramId);
    }
  }

  // No subcommand found - execute this command's handler
  if (cmd.handler) {
    return cmd.handler(args, telegramId);
  }

  // No handler - return unknown subcommand message
  return { text: `Unknown subcommand. Use /help for available commands.` };
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
 * @param commands - Root commands map
 * @param callbackData - Full callback data with path
 * @returns CallbackHandler if found
 */
export function findCallbackByPath(
  commands: Map<string, Command>,
  callbackData: string,
): CallbackHandler | undefined {
  // Parse: "wallet/export:confirm" → path=["wallet","export"], fullKey="wallet/export:confirm"
  const colonIndex = callbackData.lastIndexOf(":");
  if (colonIndex === -1) return undefined;

  const pathPart = callbackData.substring(0, colonIndex);
  const segments = pathPart.split("/");

  // Navigate to the target command
  let current: Command | undefined;
  let currentCommands = commands;

  for (const segment of segments) {
    current = currentCommands.get(segment);
    if (!current) return undefined;
    currentCommands = current.subcommands ?? new Map();
  }

  // Get callback from target command (key includes full path)
  return current?.callbacks?.get(callbackData);
}
