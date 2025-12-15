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
  private definitions: CommandDefinition[];
  private handlers: Map<string, CommandHandler>;

  constructor(deps: DevCommandRegistryDeps) {
    // Compose definitions for dev mode - all commands available
    this.definitions = [
      Definitions.wallet,
      Definitions.portfolio,
      Definitions.dca,
      Definitions.prices,
      Definitions.swap,
    ];

    // Compose handlers for dev mode
    this.handlers = new Map([
      ["wallet", createWalletHandler(deps.wallet)],
      ["portfolio", createPortfolioHandler(deps.portfolio)],
      ["dca", createDcaHandler(deps.dca)],
      ["prices", createPricesHandler(deps.prices)],
      ["swap", createSwapHandler(deps.swap)],
    ]);
  }

  getDefinitions(): CommandDefinition[] {
    return this.definitions;
  }

  getHandler(name: string): CommandHandler | undefined {
    return this.handlers.get(name);
  }

  getModeInfo(): ModeInfo {
    return {
      label: "Development",
      description: "All features available. Using shared dev wallet.",
    };
  }
}
