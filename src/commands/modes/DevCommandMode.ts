/**
 * Development command mode - contains all commands including dev-only ones
 */

import { BaseCommandMode } from "./BaseCommandMode.js";
import {
  handleWalletCommand,
  handleBalanceCommand,
  handleStatusCommand,
  handleBuyCommand,
  handleResetCommand,
} from "../handlers/index.js";

export class DevCommandMode extends BaseCommandMode {
  constructor() {
    super();
    this.registerCommands();
  }

  private registerCommands(): void {
    // Base commands
    this.registerCommand({
      name: "wallet",
      description: "Manage your wallet",
      handler: handleWalletCommand,
    });

    this.registerCommand({
      name: "balance",
      description: "Check SOL balance",
      handler: handleBalanceCommand,
    });

    // Dev-only commands
    this.registerCommand({
      name: "status",
      description: "Portfolio status (dev mode)",
      handler: handleStatusCommand,
    });

    this.registerCommand({
      name: "buy",
      description: "Mock purchase (dev mode)",
      handler: handleBuyCommand,
    });

    this.registerCommand({
      name: "reset",
      description: "Reset portfolio (dev mode)",
      handler: handleResetCommand,
    });
  }

  override getHelpText(): string {
    const commandList = this.getCommands()
      .map((cmd) => `/${cmd.name} - ${cmd.description}`)
      .join("\n");

    return (
      "Healthy Crypto Index DCA Bot\n\n" +
      "Target allocations:\n" +
      "- BTC: 40%\n" +
      "- ETH: 30%\n" +
      "- SOL: 30%\n\n" +
      "Commands:\n" +
      commandList +
      "\n\n" +
      "The bot purchases the asset furthest below its target allocation.\n\n" +
      "Note: In development mode, purchases are simulated without real swaps."
    );
  }
}
