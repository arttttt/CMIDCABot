/**
 * Development mode command registry
 *
 * Composes all available commands for development mode.
 * Includes: wallet, portfolio, dca, prices, swap
 */

import {
  CommandRegistry,
  CommandDefinition,
  CommandHandler,
  CommandEntry,
  ModeInfo,
} from "./types.js";
import { Definitions } from "./definitions.js";
import {
  createWalletHandler,
  createDcaHandler,
  createPortfolioHandler,
  createPricesHandler,
  createSwapHandler,
  WalletHandlerDeps,
  DcaHandlerDeps,
  PortfolioHandlerDeps,
  PricesHandlerDeps,
  SwapHandlerDeps,
} from "./handlers.js";

/**
 * Dependencies required for DevCommandRegistry
 */
export interface DevCommandRegistryDeps {
  wallet: WalletHandlerDeps;
  dca: DcaHandlerDeps;
  portfolio: PortfolioHandlerDeps;
  prices: PricesHandlerDeps;
  swap: SwapHandlerDeps;
}

/**
 * Development mode command registry
 *
 * All commands available:
 * - wallet: Wallet management
 * - portfolio: Portfolio status and buy operations
 * - dca: Automatic purchases scheduling
 * - prices: Current asset prices
 * - swap: Quote/simulate/execute swaps
 */
export class DevCommandRegistry implements CommandRegistry {
  private commands: Map<string, CommandEntry>;

  constructor(deps: DevCommandRegistryDeps) {
    this.commands = new Map([
      ["wallet", { definition: Definitions.wallet, handler: createWalletHandler(deps.wallet) }],
      ["portfolio", { definition: Definitions.portfolio, handler: createPortfolioHandler(deps.portfolio) }],
      ["dca", { definition: Definitions.dca, handler: createDcaHandler(deps.dca) }],
      ["prices", { definition: Definitions.prices, handler: createPricesHandler(deps.prices) }],
      ["swap", { definition: Definitions.swap, handler: createSwapHandler(deps.swap) }],
    ]);
  }

  getDefinitions(): CommandDefinition[] {
    return Array.from(this.commands.values()).map((entry) => entry.definition);
  }

  getHandler(name: string): CommandHandler | undefined {
    return this.commands.get(name)?.handler;
  }

  getModeInfo(): ModeInfo {
    return {
      label: "Development",
      description: "All features available. Using shared dev wallet.",
    };
  }
}
