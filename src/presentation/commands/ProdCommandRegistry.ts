/**
 * Production mode command registry
 *
 * Composes commands available in production mode.
 * Includes: wallet only (other features require dev mode)
 */

import { CommandRegistry, CommandDefinition, CommandHandler, CallbackHandler, CommandEntry } from "./types.js";
import { Definitions } from "./definitions.js";
import { createWalletEntry, WalletHandlerDeps } from "./handlers.js";

/**
 * Dependencies required for ProdCommandRegistry
 */
export interface ProdCommandRegistryDeps {
  wallet: WalletHandlerDeps;
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
  private commands: Map<string, CommandEntry>;

  constructor(deps: ProdCommandRegistryDeps) {
    const walletEntry = createWalletEntry(deps.wallet);
    this.commands = new Map([
      ["wallet", { definition: Definitions.wallet, ...walletEntry }],
    ]);
  }

  getDefinitions(): CommandDefinition[] {
    return Array.from(this.commands.values()).map((entry) => entry.definition);
  }

  getHandler(name: string): CommandHandler | undefined {
    return this.commands.get(name)?.handler;
  }

  getCallbackHandler(callbackData: string): CallbackHandler | undefined {
    for (const entry of this.commands.values()) {
      const handler = entry.callbacks?.get(callbackData);
      if (handler) return handler;
    }
    return undefined;
  }

  getModeInfo() {
    return null;
  }
}
