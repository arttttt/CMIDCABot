/**
 * Production mode command registry
 *
 * Composes commands available in production mode.
 * Includes: wallet, portfolio, admin
 */

import { CommandRegistry, Command } from "./types.js";
import { createWalletCommand, createAdminCommand, createStartCommand, createPortfolioCommand, WalletCommandDeps, AdminCommandDeps, StartCommandDeps, PortfolioCommandDeps } from "./handlers.js";
import { prefixCallbacks } from "./router.js";

/**
 * Dependencies required for ProdCommandRegistry
 */
export interface ProdCommandRegistryDeps {
  start: StartCommandDeps;
  wallet: WalletCommandDeps;
  portfolio: PortfolioCommandDeps;
  admin: AdminCommandDeps;
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
    this.commands = new Map([
      ["start", createStartCommand(deps.start)],
      ["wallet", createWalletCommand(deps.wallet)],
      ["portfolio", createPortfolioCommand(deps.portfolio)],
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

  getModeInfo() {
    return null;
  }
}
