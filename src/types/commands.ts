/**
 * Command types and interfaces for bot command handling
 */

import { MessageContext, ServiceContext, MessageResponse } from "./handlers.js";

/**
 * Command handler function signature
 */
export type CommandHandler = (
  args: string[],
  ctx: MessageContext,
  services: ServiceContext,
) => Promise<MessageResponse>;

/**
 * Command definition with metadata
 */
export interface CommandDefinition {
  /** Command name without slash (e.g., "start", "help") */
  name: string;
  /** Short description for help text */
  description: string;
  /** The handler function */
  handler: CommandHandler;
}

/**
 * Interface for command mode that provides commands based on environment
 */
export interface CommandMode {
  /** Returns all available commands for this mode */
  getCommands(): CommandDefinition[];

  /** Returns the handler for a specific command, or undefined if not found */
  getHandler(command: string): CommandHandler | undefined;

  /** Returns help text listing all available commands */
  getHelpText(): string;

  /** Returns start message with available commands */
  getStartMessage(): string;
}
