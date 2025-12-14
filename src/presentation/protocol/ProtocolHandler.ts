/**
 * Protocol handler - coordinates use cases and formatters
 * This is the unified entry point for all UI interactions
 */

import {
  InitUserUseCase,
  ExecutePurchaseUseCase,
  GetPortfolioStatusUseCase,
  ShowWalletUseCase,
  CreateWalletUseCase,
  ImportWalletUseCase,
  DeleteWalletUseCase,
  ExportWalletKeyUseCase,
  StartDcaUseCase,
  StopDcaUseCase,
  GetDcaStatusUseCase,
  GetPricesUseCase,
  GetQuoteUseCase,
  SimulateSwapUseCase,
  ExecuteSwapUseCase,
} from "../../domain/usecases/index.js";
import {
  PurchaseFormatter,
  PortfolioFormatter,
  HelpFormatter,
  DcaWalletFormatter,
  DcaFormatter,
  PriceFormatter,
  QuoteFormatter,
  SimulateFormatter,
  SwapFormatter,
} from "../formatters/index.js";
import { UIResponse, UIMessageContext, UICallbackContext, UICommand } from "./types.js";

export interface UseCases {
  // User
  initUser: InitUserUseCase;
  // Purchase
  executePurchase: ExecutePurchaseUseCase;
  // Portfolio
  getPortfolioStatus: GetPortfolioStatusUseCase;
  // Wallet
  showWallet: ShowWalletUseCase;
  createWallet: CreateWalletUseCase;
  importWallet: ImportWalletUseCase;
  deleteWallet: DeleteWalletUseCase;
  exportWalletKey: ExportWalletKeyUseCase;
  // DCA
  startDca: StartDcaUseCase;
  stopDca: StopDcaUseCase;
  getDcaStatus: GetDcaStatusUseCase;
  // Prices
  getPrices: GetPricesUseCase;
  // Quote
  getQuote: GetQuoteUseCase;
  // Simulate
  simulateSwap: SimulateSwapUseCase;
  // Swap
  executeSwap: ExecuteSwapUseCase;
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
  private purchaseFormatter: PurchaseFormatter;
  private portfolioFormatter: PortfolioFormatter;
  private dcaWalletFormatter: DcaWalletFormatter;
  private dcaFormatter: DcaFormatter;
  private priceFormatter: PriceFormatter;
  private quoteFormatter: QuoteFormatter;
  private simulateFormatter: SimulateFormatter;
  private swapFormatter: SwapFormatter;

  constructor(
    private useCases: UseCases,
    private isDev: boolean,
  ) {
    this.helpFormatter = new HelpFormatter();
    this.purchaseFormatter = new PurchaseFormatter();
    this.portfolioFormatter = new PortfolioFormatter();
    this.dcaWalletFormatter = new DcaWalletFormatter();
    this.dcaFormatter = new DcaFormatter();
    this.priceFormatter = new PriceFormatter();
    this.quoteFormatter = new QuoteFormatter();
    this.simulateFormatter = new SimulateFormatter();
    this.swapFormatter = new SwapFormatter();

    this.registerCommands();
  }

  private registerCommands(): void {
    // Base commands (always available)
    this.registerCommand({
      name: "wallet",
      description: "Manage your DCA wallet",
      handler: (args, telegramId) => this.handleWallet(args, telegramId),
    });

    // Dev-only commands
    this.registerCommand({
      name: "dca",
      description: "Manage DCA (start/stop)",
      handler: (args, telegramId) => this.handleDca(args, telegramId),
      devOnly: true,
    });

    this.registerCommand({
      name: "portfolio",
      description: "Portfolio status and DCA buy",
      handler: (args, telegramId) => this.handlePortfolio(args, telegramId),
      devOnly: true,
    });

    this.registerCommand({
      name: "prices",
      description: "Show current asset prices",
      handler: () => this.handlePrices(),
      devOnly: true,
    });

    this.registerCommand({
      name: "swap",
      description: "Swap operations (quote/simulate/execute)",
      handler: (args, telegramId) => this.handleSwap(args, telegramId),
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

    if (subcommand === "import") {
      const privateKey = args[1];
      if (!privateKey) {
        return this.dcaWalletFormatter.formatImportUsage();
      }
      const result = await this.useCases.importWallet.execute(telegramId, privateKey);
      return this.dcaWalletFormatter.formatImportWallet(result);
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

  private async handlePortfolio(args: string[], telegramId: number): Promise<UIResponse> {
    const subcommand = args[0]?.toLowerCase();

    // /portfolio or /portfolio status - show portfolio status
    if (!subcommand || subcommand === "status") {
      const result = await this.useCases.getPortfolioStatus.execute(telegramId);
      return this.portfolioFormatter.formatStatus(result);
    }

    // /portfolio buy <amount> - purchase asset
    if (subcommand === "buy") {
      const amountStr = args[1];
      if (!amountStr) {
        return this.purchaseFormatter.formatUsage();
      }
      const amount = parseFloat(amountStr);
      const result = await this.useCases.executePurchase.execute(telegramId, amount);
      return this.purchaseFormatter.format(result);
    }

    return this.portfolioFormatter.formatUnknownSubcommand();
  }

  private async handlePrices(): Promise<UIResponse> {
    const result = await this.useCases.getPrices.execute();
    return this.priceFormatter.format(result);
  }

  private async handleSwap(args: string[], telegramId: number): Promise<UIResponse> {
    const subcommand = args[0]?.toLowerCase();

    // /swap without args - show usage
    if (!subcommand) {
      return this.swapFormatter.formatUnifiedUsage();
    }

    // /swap quote <amount> [asset] - get quote
    if (subcommand === "quote") {
      const amountStr = args[1];
      if (!amountStr) {
        return this.quoteFormatter.formatUsage();
      }
      const amount = parseFloat(amountStr);
      const asset = args[2] || "SOL";
      const result = await this.useCases.getQuote.execute(amount, asset);
      return this.quoteFormatter.format(result);
    }

    // /swap simulate <amount> [asset] - simulate swap
    if (subcommand === "simulate") {
      const amountStr = args[1];
      if (!amountStr) {
        return this.simulateFormatter.formatUsage();
      }
      const amount = parseFloat(amountStr);
      const asset = args[2] || "SOL";
      const result = await this.useCases.simulateSwap.execute(telegramId, amount, asset);
      return this.simulateFormatter.format(result);
    }

    // /swap execute <amount> [asset] - execute real swap
    if (subcommand === "execute") {
      const amountStr = args[1];
      if (!amountStr) {
        return this.swapFormatter.formatUsage();
      }
      const amount = parseFloat(amountStr);
      const asset = args[2] || "SOL";
      const result = await this.useCases.executeSwap.execute(telegramId, amount, asset);
      return this.swapFormatter.format(result);
    }

    return this.swapFormatter.formatUnifiedUsage();
  }
}
