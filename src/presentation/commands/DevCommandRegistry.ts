/**
 * Development mode command registry
 *
 * Composes all available commands for development mode.
 * Includes: wallet, portfolio, prices, market, swap, admin
 */

import { CommandRegistry, Command, ModeInfo } from "./types.js";
import {
  WalletCommandDeps,
  PortfolioCommandDeps,
  PricesCommandDeps,
  MarketCommandDeps,
  SwapCommandDeps,
  AdminCommandDeps,
  StartCommandDeps,
  VersionCommandDeps,
  HelpCommandExternalDeps,
} from "./dependencies.js";
import {
  WalletCommand,
  PortfolioCommand,
  PricesCommand,
  MarketCommand,
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
  portfolio: PortfolioCommandDeps;
  prices: PricesCommandDeps;
  market: MarketCommandDeps;
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
 * - prices: Current asset prices
 * - market: Market status and active buy signals
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
      ["prices", new PricesCommand(deps.prices)],
      ["market", new MarketCommand(deps.market)],
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
