/**
 * Production mode command registry
 *
 * Composes commands available in production mode.
 * Includes: wallet only (other features require dev mode)
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
  WalletHandlerDeps,
} from "./handlers.js";

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
  private definitions: Map<string, CommandDefinition>;
  private handlers: Map<string, CommandHandler>;

  constructor(deps: ProdCommandRegistryDeps) {
    // Compose definitions for prod mode - limited set
    this.definitions = new Map<string, CommandDefinition>([
      [Definitions.wallet.name, Definitions.wallet],
    ]);

    // Compose handlers for prod mode
    this.handlers = new Map([
      ["wallet", createWalletHandler(deps.wallet)],
    ]);
  }

  getDefinitions(): CommandDefinition[] {
    return Array.from(this.definitions.values());
  }

  getDefinition(name: string): CommandDefinition | undefined {
    return this.definitions.get(name);
  }

  getHandler(name: string): CommandHandler | undefined {
    return this.handlers.get(name);
  }

  getModeInfo(): ModeInfo {
    return {
      label: "Production",
      description: "Real transactions. Your personal wallet.",
    };
  }
}
