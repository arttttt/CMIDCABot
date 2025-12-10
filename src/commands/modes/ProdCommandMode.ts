/**
 * Production command mode - contains only production-ready commands
 */

import { BaseCommandMode } from "./BaseCommandMode.js";
import {
  handleWalletCommand,
  handleBalanceCommand,
} from "../handlers/index.js";

export class ProdCommandMode extends BaseCommandMode {
  constructor() {
    super();
    this.registerCommands();
  }

  private registerCommands(): void {
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
  }

  override getHelpText(): string {
    const baseHelp = super.getHelpText();
    return baseHelp;
  }
}
