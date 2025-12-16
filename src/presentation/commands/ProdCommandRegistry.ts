/**
 * Production mode command registry
 *
 * Composes commands available in production mode.
 * Includes: wallet, admin
 */

import { CommandRegistry, Command } from "./types.js";
import { createWalletCommand, createAdminCommand, WalletCommandDeps, AdminCommandDeps } from "./handlers.js";
import { prefixCallbacks } from "./router.js";

/**
 * Dependencies required for ProdCommandRegistry
 */
export interface ProdCommandRegistryDeps {
  wallet: WalletCommandDeps;
  admin: AdminCommandDeps;
}

/**
 * Production mode command registry
 *
 * Limited command set:
 * - wallet: Wallet management
 * - admin: User management (requires admin privileges)
 *
 * Other commands (portfolio, dca, prices, swap) require dev mode.
 */
export class ProdCommandRegistry implements CommandRegistry {
  private commands: Map<string, Command>;

  constructor(deps: ProdCommandRegistryDeps) {
    this.commands = new Map([
      ["wallet", createWalletCommand(deps.wallet)],
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
