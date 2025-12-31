/**
 * Command definitions - describes what commands do
 *
 * These are reusable across different modes.
 * Definitions are pure data, no logic.
 *
 * Note: Subcommand info is now derived from Command.subcommands structure.
 */

import { CommandDefinition } from "./types.js";

/**
 * All command definitions
 */
export const Definitions = {
  start: {
    name: "start",
    description: "Start the bot / activate invite",
  },

  wallet: {
    name: "wallet",
    description: "Wallet management (create/import/export/delete)",
  },

  portfolio: {
    name: "portfolio",
    description: "Portfolio status and manual buy",
  },

  dca: {
    name: "dca",
    description: "Automatic purchases (status/start/stop)",
  },

  prices: {
    name: "prices",
    description: "Current prices for BTC, ETH, SOL",
  },

  swap: {
    name: "swap",
    description: "Swap USDC to assets (quote/simulate/execute)",
  },

  admin: {
    name: "admin",
    description: "User management (add/remove/list/role)",
  },

  version: {
    name: "version",
    description: "Show bot version",
  },

  help: {
    name: "help",
    description: "Show available commands",
  },
} as const satisfies Record<string, CommandDefinition>;

/**
 * Type-safe access to definitions
 */
export type DefinitionKey = keyof typeof Definitions;
