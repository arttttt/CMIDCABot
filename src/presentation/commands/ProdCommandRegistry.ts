/**
 * Production mode command registry
 *
 * Composes commands available in production mode.
 * Includes: wallet only (other features require dev mode)
 */

import { CommandRegistry, Command } from "./types.js";
import { createWalletCommand, WalletCommandDeps } from "./handlers.js";

/**
 * Dependencies required for ProdCommandRegistry
 */
export interface ProdCommandRegistryDeps {
  wallet: WalletCommandDeps;
}

/**
 * Production mode command registry
 *
 * Limited command set:
 * - wallet: Wallet management
 *
 * Other commands (portfolio, dca, prices, swap) require dev mode.
 */
export class ProdCommandRegistry implements CommandRegistry {
  private commands: Map<string, Command>;

  constructor(deps: ProdCommandRegistryDeps) {
    this.commands = new Map([["wallet", createWalletCommand(deps.wallet)]]);
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
