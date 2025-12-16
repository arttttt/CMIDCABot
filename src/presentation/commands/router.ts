/**
 * Command router - recursive command execution
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
 * Find callback handler in command tree (recursive search)
 *
 * @param cmd - Command to search in
 * @param callbackData - Callback data to find
 * @returns CallbackHandler if found
 */
export function findCallback(cmd: Command, callbackData: string): CallbackHandler | undefined {
  // Check this command's callbacks
  const handler = cmd.callbacks?.get(callbackData);
  if (handler) return handler;

  // Search in subcommands
  if (cmd.subcommands) {
    for (const sub of cmd.subcommands.values()) {
      const found = findCallback(sub, callbackData);
      if (found) return found;
    }
  }

  return undefined;
}

/**
 * Find callback handler across all commands in registry
 *
 * @param commands - Map of all commands
 * @param callbackData - Callback data to find
 * @returns CallbackHandler if found
 */
export function findCallbackInRegistry(
  commands: Map<string, Command>,
  callbackData: string,
): CallbackHandler | undefined {
  for (const cmd of commands.values()) {
    const handler = findCallback(cmd, callbackData);
    if (handler) return handler;
  }
  return undefined;
}
