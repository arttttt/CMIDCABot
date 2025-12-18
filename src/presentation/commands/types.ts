/**
 * Command architecture types
 *
 * Composable command structure:
 * - Command contains definition, handler, subcommands, and callbacks
 * - Subcommands are recursive - same Command structure
 * - Routing is done by traversing the command tree
 */

import { UIResponse } from "../protocol/types.js";
import type { UserRole } from "../../domain/models/AuthorizedUser.js";

/**
 * Command definition - metadata for help/registration
 */
export interface CommandDefinition {
  name: string;
  description: string;
  /** Usage hint for commands with parameters, e.g. "<amount> [asset]" */
  usage?: string;
}

/**
 * Command handler function signature
 */
export type CommandHandler = (args: string[], telegramId: number) => Promise<UIResponse>;

/**
 * Callback handler function signature
 */
export type CallbackHandler = (telegramId: number) => Promise<UIResponse>;

/**
 * Result of callback lookup - includes handler and required role
 */
export interface CallbackLookupResult {
  handler: CallbackHandler;
  requiredRole?: UserRole;
}

/**
 * Command - composable command structure
 *
 * Can contain:
 * - definition: metadata for help/registration
 * - requiredRole: minimum role required to access this command
 * - handler: executes when command is called (with remaining args)
 * - subcommands: nested commands (recursive structure)
 * - callbacks: inline button handlers for this command
 */
export interface Command {
  definition: CommandDefinition;
  /**
   * Minimum role required to access this command.
   * If not specified, command is available to all authorized users.
   * Hierarchy: owner > admin > user
   */
  requiredRole?: UserRole;
  handler?: CommandHandler;
  subcommands?: Map<string, Command>;
  callbacks?: Map<string, CallbackHandler>;
}

/**
 * Mode information for display
 */
export interface ModeInfo {
  label: string;
  description: string;
}

/**
 * Command registry interface - top-level command container
 */
export interface CommandRegistry {
  /**
   * Get command by name
   */
  getCommand(name: string): Command | undefined;

  /**
   * Get all commands
   */
  getCommands(): Map<string, Command>;

  /**
   * Get mode information for display (null for production)
   */
  getModeInfo(): ModeInfo | null;
}
