/**
 * Protocol handler - coordinates use cases and formatters
 * This is the unified entry point for all UI interactions
 */

import {
  InitUserUseCase,
  GetBalanceUseCase,
  ExecutePurchaseUseCase,
  GetPortfolioStatusUseCase,
  ResetPortfolioUseCase,
  ShowWalletUseCase,
  CreateWalletUseCase,
  DeleteWalletUseCase,
  ExportWalletKeyUseCase,
  StartDcaUseCase,
  StopDcaUseCase,
  GetDcaStatusUseCase,
  GetPricesUseCase,
} from "../../domain/usecases/index.js";
import {
  BalanceFormatter,
  PurchaseFormatter,
  PortfolioFormatter,
  HelpFormatter,
  DcaWalletFormatter,
  DcaFormatter,
  PriceFormatter,
} from "../formatters/index.js";
import { UIResponse, UIMessageContext, UICallbackContext, UICommand } from "./types.js";

export interface UseCases {
  // User
  initUser: InitUserUseCase;
  // Balance
  getBalance: GetBalanceUseCase;
  // Purchase
  executePurchase: ExecutePurchaseUseCase;
  // Portfolio
  getPortfolioStatus: GetPortfolioStatusUseCase;
  resetPortfolio: ResetPortfolioUseCase;
  // Wallet
  showWallet: ShowWalletUseCase;
  createWallet: CreateWalletUseCase;
  deleteWallet: DeleteWalletUseCase;
  exportWalletKey: ExportWalletKeyUseCase;
  // DCA
  startDca: StartDcaUseCase;
  stopDca: StopDcaUseCase;
  getDcaStatus: GetDcaStatusUseCase;
  // Prices
  getPrices: GetPricesUseCase;
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
  private balanceFormatter: BalanceFormatter;
  private purchaseFormatter: PurchaseFormatter;
  private portfolioFormatter: PortfolioFormatter;
  private dcaWalletFormatter: DcaWalletFormatter;
  private dcaFormatter: DcaFormatter;
  private priceFormatter: PriceFormatter;

  constructor(
    private useCases: UseCases,
    private isDev: boolean,
  ) {
    this.helpFormatter = new HelpFormatter();
    this.balanceFormatter = new BalanceFormatter();
    this.purchaseFormatter = new PurchaseFormatter();
    this.portfolioFormatter = new PortfolioFormatter();
    this.dcaWalletFormatter = new DcaWalletFormatter();
    this.dcaFormatter = new DcaFormatter();
    this.priceFormatter = new PriceFormatter();

    this.registerCommands();
  }

  private registerCommands(): void {
    // Base commands (always available)
    this.registerCommand({
      name: "wallet",
      description: "Manage your DCA wallet",
      handler: (args, telegramId) => this.handleWallet(args, telegramId),
    });

    this.registerCommand({
      name: "balance",
      description: "Check SOL balance",
      handler: (_args, telegramId) => this.handleBalance(telegramId),
    });

    this.registerCommand({
      name: "dca",
      description: "Manage DCA (start/stop)",
      handler: (args, telegramId) => this.handleDca(args, telegramId),
      devOnly: true,
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

    this.registerCommand({
      name: "prices",
      description: "Show current asset prices (dev mode)",
      handler: () => this.handlePrices(),
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
      await this.useCases.initUser.execute(telegramId);
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
  async handleCallback(_ctx: UICallbackContext): Promise<UIResponse> {
    return { text: "Unknown action." };
  }

  // Command handlers

  private async handleWallet(args: string[], telegramId: number): Promise<UIResponse> {
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand) {
      const result = await this.useCases.showWallet.execute(telegramId);
      return this.dcaWalletFormatter.formatShowWallet(result);
    }

    if (subcommand === "create") {
      const result = await this.useCases.createWallet.execute(telegramId);
      return this.dcaWalletFormatter.formatCreateWallet(result);
    }

    if (subcommand === "export") {
      const result = await this.useCases.exportWalletKey.execute(telegramId);
      return this.dcaWalletFormatter.formatExportKey(result);
    }

    if (subcommand === "delete") {
      const result = await this.useCases.deleteWallet.execute(telegramId);
      return this.dcaWalletFormatter.formatDeleteWallet(result);
    }

    return this.dcaWalletFormatter.formatUnknownSubcommand();
  }

  private async handleBalance(telegramId: number): Promise<UIResponse> {
    const result = await this.useCases.getBalance.execute(telegramId);
    return this.balanceFormatter.format(result);
  }

  private async handleStatus(telegramId: number): Promise<UIResponse> {
    const result = await this.useCases.getPortfolioStatus.execute(telegramId);
    return this.portfolioFormatter.formatStatus(result);
  }

  private async handleBuy(args: string[], telegramId: number): Promise<UIResponse> {
    const amountStr = args[0];
    if (!amountStr) {
      return this.purchaseFormatter.formatUsage();
    }

    const amount = parseFloat(amountStr);
    const result = await this.useCases.executePurchase.execute(telegramId, amount);
    return this.purchaseFormatter.format(result);
  }

  private async handleReset(telegramId: number): Promise<UIResponse> {
    const result = await this.useCases.resetPortfolio.execute(telegramId);
    return this.portfolioFormatter.formatReset(result);
  }

  private async handleDca(args: string[], telegramId: number): Promise<UIResponse> {
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand) {
      const result = await this.useCases.getDcaStatus.execute(telegramId);
      return this.dcaFormatter.formatStatus(result);
    }

    if (subcommand === "start") {
      const result = await this.useCases.startDca.execute(telegramId);
      return this.dcaFormatter.formatStart(result);
    }

    if (subcommand === "stop") {
      const result = await this.useCases.stopDca.execute(telegramId);
      return this.dcaFormatter.formatStop(result);
    }

    return this.dcaFormatter.formatUnknownSubcommand();
  }

  private async handlePrices(): Promise<UIResponse> {
    const result = await this.useCases.getPrices.execute();
    return this.priceFormatter.format(result);
  }
}
