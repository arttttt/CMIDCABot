/**
 * Protocol handler - coordinates use cases and formatters
 * This is the unified entry point for all UI interactions
 */

import {
  WalletUseCases,
  BalanceUseCases,
  PurchaseUseCases,
  PortfolioUseCases,
  UserUseCases,
} from "../../domain/usecases/index.js";
import {
  WalletFormatter,
  BalanceFormatter,
  PurchaseFormatter,
  PortfolioFormatter,
  HelpFormatter,
} from "../formatters/index.js";
import { UIResponse, UIMessageContext, UICallbackContext, UICommand } from "./types.js";

export interface UseCases {
  wallet: WalletUseCases;
  balance: BalanceUseCases;
  purchase: PurchaseUseCases;
  portfolio: PortfolioUseCases;
  user: UserUseCases;
}

interface CommandConfig {
  name: string;
  description: string;
  handler: (args: string[], telegramId: number) => Promise<UIResponse>;
  devOnly?: boolean;
}

export class ProtocolHandler {
  private commands: Map<string, CommandConfig> = new Map();
  private helpFormatter: HelpFormatter;
  private walletFormatter: WalletFormatter;
  private balanceFormatter: BalanceFormatter;
  private purchaseFormatter: PurchaseFormatter;
  private portfolioFormatter: PortfolioFormatter;

  constructor(
    private useCases: UseCases,
    private isDev: boolean,
  ) {
    this.helpFormatter = new HelpFormatter();
    this.walletFormatter = new WalletFormatter();
    this.balanceFormatter = new BalanceFormatter();
    this.purchaseFormatter = new PurchaseFormatter();
    this.portfolioFormatter = new PortfolioFormatter();

    this.registerCommands();
  }

  private registerCommands(): void {
    // Base commands (always available)
    this.registerCommand({
      name: "wallet",
      description: "Manage your wallet",
      handler: (args, telegramId) => this.handleWallet(args, telegramId),
    });

    this.registerCommand({
      name: "balance",
      description: "Check SOL balance",
      handler: (_args, telegramId) => this.handleBalance(telegramId),
    });

    // Dev-only commands
    this.registerCommand({
      name: "status",
      description: "Portfolio status (dev mode)",
      handler: (_args, telegramId) => this.handleStatus(telegramId),
      devOnly: true,
    });

    this.registerCommand({
      name: "buy",
      description: "Mock purchase (dev mode)",
      handler: (args, telegramId) => this.handleBuy(args, telegramId),
      devOnly: true,
    });

    this.registerCommand({
      name: "reset",
      description: "Reset portfolio (dev mode)",
      handler: (_args, telegramId) => this.handleReset(telegramId),
      devOnly: true,
    });
  }

  private registerCommand(config: CommandConfig): void {
    this.commands.set(`/${config.name}`, config);
  }

  /**
   * Get available commands for this mode
   */
  getAvailableCommands(): UICommand[] {
    return Array.from(this.commands.values())
      .filter((cmd) => !cmd.devOnly || this.isDev)
      .map((cmd) => ({ name: cmd.name, description: cmd.description }));
  }

  /**
   * Handle incoming message
   */
  async handleMessage(ctx: UIMessageContext): Promise<UIResponse> {
    const text = ctx.text.trim();

    if (text.startsWith("/")) {
      const parts = text.split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);
      return this.handleCommand(command, args, ctx.telegramId);
    }

    return { text: "Unknown command. Use /help to see available commands." };
  }

  private async handleCommand(
    command: string,
    args: string[],
    telegramId: number,
  ): Promise<UIResponse> {
    // Special commands
    if (command === "/start") {
      await this.useCases.user.initUser(telegramId);
      return {
        text: this.helpFormatter.formatStartMessage(this.getAvailableCommands()),
      };
    }

    if (command === "/help") {
      return {
        text: this.helpFormatter.formatHelp(this.getAvailableCommands(), this.isDev),
      };
    }

    // Look up command
    const config = this.commands.get(command);
    if (!config) {
      return { text: `Unknown command: ${command}\nUse /help to see available commands.` };
    }

    // Check dev-only access
    if (config.devOnly && !this.isDev) {
      return { text: `This command is only available in development mode.` };
    }

    return config.handler(args, telegramId);
  }

  /**
   * Handle callback query (button press)
   */
  async handleCallback(ctx: UICallbackContext): Promise<UIResponse> {
    // Try wallet callback
    const walletResult = await this.useCases.wallet.handleCallback(
      ctx.telegramId,
      ctx.callbackData,
    );

    if (walletResult.type !== "unknown") {
      return this.walletFormatter.formatCallbackResult(walletResult);
    }

    return { text: "Unknown action." };
  }

  // Command handlers

  private async handleWallet(args: string[], telegramId: number): Promise<UIResponse> {
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand) {
      const result = await this.useCases.wallet.showWallet(telegramId);
      return this.walletFormatter.formatShowWallet(result);
    }

    if (subcommand === "set") {
      const address = args[1];
      if (!address) {
        return this.walletFormatter.formatMissingAddress();
      }

      if (!this.useCases.wallet.isValidAddress(address)) {
        return this.walletFormatter.formatInvalidAddress();
      }

      const result = await this.useCases.wallet.setWallet(telegramId, address);
      return this.walletFormatter.formatSetWallet(result);
    }

    if (subcommand === "remove") {
      const result = await this.useCases.wallet.removeWallet(telegramId);
      return this.walletFormatter.formatRemoveWallet(result);
    }

    return this.walletFormatter.formatUnknownSubcommand();
  }

  private async handleBalance(telegramId: number): Promise<UIResponse> {
    const result = await this.useCases.balance.getBalance(telegramId);
    return this.balanceFormatter.format(result);
  }

  private async handleStatus(telegramId: number): Promise<UIResponse> {
    const result = await this.useCases.portfolio.getStatus(telegramId);
    return this.portfolioFormatter.formatStatus(result);
  }

  private async handleBuy(args: string[], telegramId: number): Promise<UIResponse> {
    const amountStr = args[0];
    if (!amountStr) {
      return this.purchaseFormatter.formatUsage();
    }

    const amount = parseFloat(amountStr);
    const result = await this.useCases.purchase.executePurchase(telegramId, amount);
    return this.purchaseFormatter.format(result);
  }

  private async handleReset(telegramId: number): Promise<UIResponse> {
    const result = await this.useCases.portfolio.reset(telegramId);
    return this.portfolioFormatter.formatReset(result);
  }
}
