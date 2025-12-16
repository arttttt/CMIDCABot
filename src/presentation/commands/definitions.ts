/**
 * Command definitions - describes what commands do
 *
 * These are reusable across different modes.
 * Definitions are pure data, no logic.
 */

import { CommandDefinition } from "./types.js";

/**
 * All command definitions
 */
export const Definitions = {
  wallet: {
    name: "wallet",
    description: "Wallet management (create/import/export/delete)",
    subcommands: [
      { usage: "/wallet", description: "Show current wallet" },
      { usage: "/wallet create", description: "Create new wallet" },
      { usage: "/wallet import <key>", description: "Import wallet from private key" },
      { usage: "/wallet export", description: "Export private key" },
      { usage: "/wallet delete", description: "Delete wallet" },
    ],
  },

  portfolio: {
    name: "portfolio",
    description: "Portfolio status and manual buy",
    subcommands: [
      { usage: "/portfolio", description: "Show portfolio status" },
      { usage: "/portfolio buy <amount>", description: "Buy asset for USDC amount" },
    ],
  },

  dca: {
    name: "dca",
    description: "Automatic purchases (status/start/stop)",
    subcommands: [
      { usage: "/dca", description: "Show DCA status" },
      { usage: "/dca start", description: "Start automatic purchases" },
      { usage: "/dca stop", description: "Stop automatic purchases" },
    ],
  },

  prices: {
    name: "prices",
    description: "Current prices for BTC, ETH, SOL",
  },

  swap: {
    name: "swap",
    description: "Swap USDC to assets (quote/simulate/execute)",
    subcommands: [
      { usage: "/swap quote <amount> [asset]", description: "Get quote for swap" },
      { usage: "/swap simulate <amount> [asset]", description: "Simulate swap without executing" },
      { usage: "/swap execute <amount> [asset]", description: "Execute real swap" },
    ],
  },
} as const satisfies Record<string, CommandDefinition>;

/**
 * Type-safe access to definitions
 */
export type DefinitionKey = keyof typeof Definitions;
