/**
 * Command architecture types
 *
 * Three-layer separation:
 * 1. CommandDefinition - describes what command does (data)
 * 2. CommandHandler - executes command logic (function)
 * 3. CommandRegistry - composes definitions + handlers for a mode
 */

import { UIResponse } from "../protocol/types.js";

/**
 * Subcommand definition for help display
 */
export interface SubcommandDefinition {
  usage: string;
  description: string;
}

/**
 * Command definition - describes what command does
 * Reusable across different modes
 */
export interface CommandDefinition {
  name: string;
  description: string;
  subcommands?: SubcommandDefinition[];
}

/**
 * Command handler function signature
 */
export type CommandHandler = (
  args: string[],
  telegramId: number,
) => Promise<UIResponse>;

/**
 * Command entry - definition + handler pair
 */
export interface CommandEntry {
  definition: CommandDefinition;
  handler: CommandHandler;
}

/**
 * Mode information for display
 */
export interface ModeInfo {
  label: string;
  description: string;
}

/**
 * Command registry interface - composes definitions + handlers for a mode
 */
export interface CommandRegistry {
  /**
   * Get all command definitions available in this mode
   */
  getDefinitions(): CommandDefinition[];

  /**
   * Get handler for a command by name (O(1) lookup)
   */
  getHandler(name: string): CommandHandler | undefined;

  /**
   * Get mode information for display
   */
  getModeInfo(): ModeInfo;
}
