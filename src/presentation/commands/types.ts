/**
 * Command architecture types
 *
 * Composable command structure:
 * - Command contains definition, handler, subcommands, and callbacks
 * - Subcommands are recursive - same Command structure
 * - Routing is done by traversing the command tree
 */

import { ClientResponseStream } from "../protocol/types.js";
import type { UserRole } from "../../domain/models/AuthorizedUser.js";
import type { CommandExecutionContext } from "./CommandExecutionContext.js";

export type { CommandExecutionContext };

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
 *
 * Every handler is reactive: it returns a stream of StreamItems.
 * One-shot commands yield a single item with mode "final"
 * (see StreamUtils.final / StreamUtils.finalFrom).
 */
export type CommandHandler = (
  args: string[],
  ctx: CommandExecutionContext,
) => ClientResponseStream;

/**
 * Callback handler function signature
 * @param ctx - Command execution context
 * @param params - Parameters extracted from callback data (format: action:param1:param2:...)
 */
export type CallbackHandler = (
  ctx: CommandExecutionContext,
  params: string[],
) => ClientResponseStream;

/**
 * Callback parameter schema - describes expected parameter
 */
export interface CallbackParamSchema {
  /** Parameter name (for documentation/debugging) */
  name: string;
  /** Maximum length of the parameter value */
  maxLength: number;
}

/**
 * Callback definition - handler with optional parameter schema
 */
export interface CallbackDefinition {
  handler: CallbackHandler;
  /** Parameter schemas for validation. If undefined, callback takes no parameters. */
  params?: CallbackParamSchema[];
}

/**
 * Result of callback lookup - includes handler and required role
 */
export interface CallbackLookupResult {
  handler: CallbackHandler;
  requiredRole?: UserRole;
  /** Parameters extracted from callback data (format: action:param1:param2:...) */
  params: string[];
}

/**
 * Command - composable command structure
 *
 * Can contain:
 * - definition: metadata for help/registration
 * - requiredRole: minimum role required to access this command
 * - handler: executes when command is called (with remaining args),
 *   yielding StreamItems for progress updates and the final result
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
  callbacks?: Map<string, CallbackDefinition>;
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
