/**
 * Production mode command registry
 *
 * Composes commands available in production mode.
 * Includes: wallet, portfolio, admin
 */

import { CommandRegistry, Command } from "./types.js";
import {
  WalletCommandDeps,
  AdminCommandDeps,
  StartCommandDeps,
  PortfolioCommandDeps,
  VersionCommandDeps,
  HelpCommandExternalDeps,
} from "./dependencies.js";
import {
  WalletCommand,
  AdminCommand,
  StartCommand,
  PortfolioCommand,
  VersionCommand,
  HelpCommand,
} from "./handlers/index.js";
import { prefixCallbacks } from "./router.js";

/**
 * Dependencies required for ProdCommandRegistry
 */
export interface ProdCommandRegistryDeps {
  start: StartCommandDeps;
  wallet: WalletCommandDeps;
  portfolio: PortfolioCommandDeps;
  admin: AdminCommandDeps;
  version: VersionCommandDeps;
  help: HelpCommandExternalDeps;
}

/**
 * Production mode command registry
 *
 * Command set:
 * - wallet: Wallet management
 * - portfolio: Portfolio status and buy operations
 * - admin: User management (requires admin privileges)
 *
 * Other commands (dca, prices, swap) require dev mode.
 */
export class ProdCommandRegistry implements CommandRegistry {
  private commands: Map<string, Command>;

  constructor(deps: ProdCommandRegistryDeps) {
    // Create help command with lazy registry reference to break circular dependency
    const helpCommand = new HelpCommand({
      ...deps.help,
      getRegistry: () => this,
    });

    this.commands = new Map<string, Command>([
      ["start", new StartCommand(deps.start)],
      ["wallet", new WalletCommand(deps.wallet)],
      ["portfolio", new PortfolioCommand(deps.portfolio)],
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

  getModeInfo() {
    return null;
  }
}
