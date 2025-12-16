/**
 * Development mode command registry
 *
 * Composes all available commands for development mode.
 * Includes: wallet, portfolio, dca, prices, swap, admin
 */

import { CommandRegistry, Command, ModeInfo } from "./types.js";
import {
  createWalletCommand,
  createDcaCommand,
  createPortfolioCommand,
  createPricesCommand,
  createSwapCommand,
  createAdminCommand,
  WalletCommandDeps,
  DcaCommandDeps,
  PortfolioCommandDeps,
  PricesCommandDeps,
  SwapCommandDeps,
  AdminCommandDeps,
} from "./handlers.js";
import { prefixCallbacks } from "./router.js";

/**
 * Dependencies required for DevCommandRegistry
 */
export interface DevCommandRegistryDeps {
  wallet: WalletCommandDeps;
  dca: DcaCommandDeps;
  portfolio: PortfolioCommandDeps;
  prices: PricesCommandDeps;
  swap: SwapCommandDeps;
  admin: AdminCommandDeps;
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
 * - admin: User management (requires admin privileges)
 */
export class DevCommandRegistry implements CommandRegistry {
  private commands: Map<string, Command>;

  constructor(deps: DevCommandRegistryDeps) {
    this.commands = new Map([
      ["wallet", createWalletCommand(deps.wallet)],
      ["portfolio", createPortfolioCommand(deps.portfolio)],
      ["dca", createDcaCommand(deps.dca)],
      ["prices", createPricesCommand(deps.prices)],
      ["swap", createSwapCommand(deps.swap)],
      ["admin", createAdminCommand(deps.admin)],
    ]);
    prefixCallbacks(this.commands);
  }

  getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }

  getCommands(): Map<string, Command> {
    return this.commands;
  }

  getModeInfo(): ModeInfo {
    return {
      label: "Development",
      description: "All features available. Using shared dev wallet.",
    };
  }
}
