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
  createStartCommand,
  createVersionCommand,
  createHelpCommand,
  WalletCommandDeps,
  DcaCommandDeps,
  PortfolioCommandDeps,
  PricesCommandDeps,
  SwapCommandDeps,
  AdminCommandDeps,
  StartCommandDeps,
  VersionCommandDeps,
  HelpCommandExternalDeps,
} from "./handlers.js";
import { prefixCallbacks } from "./router.js";

/**
 * Dependencies required for DevCommandRegistry
 */
export interface DevCommandRegistryDeps {
  start: StartCommandDeps;
  wallet: WalletCommandDeps;
  dca: DcaCommandDeps;
  portfolio: PortfolioCommandDeps;
  prices: PricesCommandDeps;
  swap: SwapCommandDeps;
  admin: AdminCommandDeps;
  version: VersionCommandDeps;
  help: HelpCommandExternalDeps;
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
    // Create help command with lazy registry reference to break circular dependency
    const helpCommand = createHelpCommand({
      ...deps.help,
      getRegistry: () => this,
    });

    this.commands = new Map([
      ["start", createStartCommand(deps.start)],
      ["wallet", createWalletCommand(deps.wallet)],
      ["portfolio", createPortfolioCommand(deps.portfolio)],
      ["dca", createDcaCommand(deps.dca)],
      ["prices", createPricesCommand(deps.prices)],
      ["swap", createSwapCommand(deps.swap)],
      ["admin", createAdminCommand(deps.admin)],
      ["version", createVersionCommand(deps.version)],
      ["help", helpCommand],
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
