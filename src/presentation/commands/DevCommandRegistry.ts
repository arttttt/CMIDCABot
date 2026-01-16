/**
 * Development mode command registry
 *
 * Composes all available commands for development mode.
 * Includes: wallet, portfolio, dca, prices, swap, admin
 */

import { CommandRegistry, Command, ModeInfo } from "./types.js";
import {
  WalletCommandDeps,
  DcaCommandDeps,
  PortfolioCommandDeps,
  PricesCommandDeps,
  SwapCommandDeps,
  AdminCommandDeps,
  StartCommandDeps,
  VersionCommandDeps,
  HelpCommandExternalDeps,
} from "./dependencies.js";
import {
  WalletCommand,
  DcaCommand,
  PortfolioCommand,
  PricesCommand,
  SwapCommand,
  AdminCommand,
  StartCommand,
  VersionCommand,
  HelpCommand,
} from "./handlers/index.js";
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
    const helpCommand = new HelpCommand({
      ...deps.help,
      getRegistry: () => this,
    });

    this.commands = new Map<string, Command>([
      ["start", new StartCommand(deps.start)],
      ["wallet", new WalletCommand(deps.wallet)],
      ["portfolio", new PortfolioCommand(deps.portfolio)],
      ["dca", new DcaCommand(deps.dca)],
      ["prices", new PricesCommand(deps.prices)],
      ["swap", new SwapCommand(deps.swap)],
      ["admin", new AdminCommand(deps.admin)],
      ["version", new VersionCommand(deps.version)],
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
      description: "All features available.",
    };
  }
}
