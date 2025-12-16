/**
 * Command definitions - describes what commands do
 *
 * These are reusable across different modes.
 * Definitions are pure data, no logic.
 *
 * Note: Subcommand info is now derived from Command.subcommands structure.
 */

import { CommandDefinition } from "./types.js";
import type { UserRole } from "../../domain/models/AuthorizedUser.js";

/**
 * All command definitions
 */
export const Definitions = {
  wallet: {
    name: "wallet",
    description: "Wallet management (create/import/export/delete)",
    requiredRole: "user" as UserRole,
  },

  portfolio: {
    name: "portfolio",
    description: "Portfolio status and manual buy",
    requiredRole: "user" as UserRole,
  },

  dca: {
    name: "dca",
    description: "Automatic purchases (status/start/stop)",
    requiredRole: "user" as UserRole,
  },

  prices: {
    name: "prices",
    description: "Current prices for BTC, ETH, SOL",
    requiredRole: "user" as UserRole,
  },

  swap: {
    name: "swap",
    description: "Swap USDC to assets (quote/simulate/execute)",
    requiredRole: "user" as UserRole,
  },

  admin: {
    name: "admin",
    description: "User management (add/remove/list/role)",
    requiredRole: "admin" as UserRole,
  },
} as const satisfies Record<string, CommandDefinition>;

/**
 * Type-safe access to definitions
 */
export type DefinitionKey = keyof typeof Definitions;
