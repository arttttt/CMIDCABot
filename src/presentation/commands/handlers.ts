/**
 * Command handler factories
 *
 * Each factory creates a handler with its specific dependencies.
 * Handlers are pure functions that process command arguments
 * and return UIResponse.
 */

import { CommandHandler, CallbackHandler } from "./types.js";
import { UIResponse } from "../protocol/types.js";

// Use cases
import {
  ShowWalletUseCase,
  CreateWalletUseCase,
  ImportWalletUseCase,
  DeleteWalletUseCase,
  ExportWalletKeyUseCase,
  StartDcaUseCase,
  StopDcaUseCase,
  GetDcaStatusUseCase,
  GetPortfolioStatusUseCase,
  ExecutePurchaseUseCase,
  GetPricesUseCase,
  GetQuoteUseCase,
  SimulateSwapUseCase,
  ExecuteSwapUseCase,
} from "../../domain/usecases/index.js";

// Formatters
import {
  DcaWalletFormatter,
  DcaFormatter,
  PortfolioFormatter,
  PurchaseFormatter,
  PriceFormatter,
  QuoteFormatter,
  SimulateFormatter,
  SwapFormatter,
} from "../formatters/index.js";

// ============================================================
// Dependencies types
// ============================================================

export interface WalletHandlerDeps {
  showWallet: ShowWalletUseCase;
  createWallet: CreateWalletUseCase;
  importWallet: ImportWalletUseCase;
  deleteWallet: DeleteWalletUseCase;
  exportWalletKey: ExportWalletKeyUseCase;
  formatter: DcaWalletFormatter;
}

export interface DcaHandlerDeps {
  startDca: StartDcaUseCase;
  stopDca: StopDcaUseCase;
  getDcaStatus: GetDcaStatusUseCase;
  formatter: DcaFormatter;
}

export interface PortfolioHandlerDeps {
  getPortfolioStatus: GetPortfolioStatusUseCase;
  executePurchase: ExecutePurchaseUseCase;
  portfolioFormatter: PortfolioFormatter;
  purchaseFormatter: PurchaseFormatter;
}

export interface PricesHandlerDeps {
  getPrices: GetPricesUseCase;
  formatter: PriceFormatter;
}

export interface SwapHandlerDeps {
  getQuote: GetQuoteUseCase;
  simulateSwap: SimulateSwapUseCase;
  executeSwap: ExecuteSwapUseCase;
  quoteFormatter: QuoteFormatter;
  simulateFormatter: SimulateFormatter;
  swapFormatter: SwapFormatter;
}

// ============================================================
// Handler factories
// ============================================================

/**
 * Create wallet command handler
 * Subcommands: (none), create, import, export, delete
 */
export function createWalletHandler(deps: WalletHandlerDeps): CommandHandler {
  const {
    showWallet,
    createWallet,
    importWallet,
    deleteWallet,
    exportWalletKey,
    formatter,
  } = deps;

  return async (args: string[], telegramId: number): Promise<UIResponse> => {
    const subcommand = args[0]?.toLowerCase();

    // /wallet - show wallet
    if (!subcommand) {
      const result = await showWallet.execute(telegramId);
      return formatter.formatShowWallet(result);
    }

    // /wallet create
    if (subcommand === "create") {
      const result = await createWallet.execute(telegramId);
      return formatter.formatCreateWallet(result);
    }

    // /wallet import <key>
    if (subcommand === "import") {
      const privateKey = args[1];
      if (!privateKey) {
        return formatter.formatImportUsage();
      }
      const result = await importWallet.execute(telegramId, privateKey);
      return formatter.formatImportWallet(result);
    }

    // /wallet export
    if (subcommand === "export") {
      const result = await exportWalletKey.execute(telegramId);
      return formatter.formatExportKey(result);
    }

    // /wallet delete
    if (subcommand === "delete") {
      const result = await deleteWallet.execute(telegramId);
      return formatter.formatDeleteWallet(result);
    }

    return formatter.formatUnknownSubcommand();
  };
}

/**
 * Create wallet callback handlers
 * Callbacks: confirm_export
 */
export function createWalletCallbackHandlers(
  deps: WalletHandlerDeps,
): Map<string, CallbackHandler> {
  const { exportWalletKey, formatter } = deps;

  return new Map([
    [
      "confirm_export",
      async (telegramId: number): Promise<UIResponse> => {
        const result = await exportWalletKey.execute(telegramId);
        return formatter.formatExportKeyConfirmed(result);
      },
    ],
  ]);
}

/**
 * Create DCA command handler
 * Subcommands: (none/status), start, stop
 */
export function createDcaHandler(deps: DcaHandlerDeps): CommandHandler {
  const { startDca, stopDca, getDcaStatus, formatter } = deps;

  return async (args: string[], telegramId: number): Promise<UIResponse> => {
    const subcommand = args[0]?.toLowerCase();

    // /dca or /dca status - show status
    if (!subcommand) {
      const result = await getDcaStatus.execute(telegramId);
      return formatter.formatStatus(result);
    }

    // /dca start
    if (subcommand === "start") {
      const result = await startDca.execute(telegramId);
      return formatter.formatStart(result);
    }

    // /dca stop
    if (subcommand === "stop") {
      const result = await stopDca.execute(telegramId);
      return formatter.formatStop(result);
    }

    return formatter.formatUnknownSubcommand();
  };
}

/**
 * Create portfolio command handler
 * Subcommands: (none/status), buy <amount>
 */
export function createPortfolioHandler(deps: PortfolioHandlerDeps): CommandHandler {
  const { getPortfolioStatus, executePurchase, portfolioFormatter, purchaseFormatter } = deps;

  return async (args: string[], telegramId: number): Promise<UIResponse> => {
    const subcommand = args[0]?.toLowerCase();

    // /portfolio or /portfolio status - show portfolio
    if (!subcommand || subcommand === "status") {
      const result = await getPortfolioStatus.execute(telegramId);
      return portfolioFormatter.formatStatus(result);
    }

    // /portfolio buy <amount>
    if (subcommand === "buy") {
      const amountStr = args[1];
      if (!amountStr) {
        return purchaseFormatter.formatUsage();
      }
      const amount = parseFloat(amountStr);
      const result = await executePurchase.execute(telegramId, amount);
      return purchaseFormatter.format(result);
    }

    return portfolioFormatter.formatUnknownSubcommand();
  };
}

/**
 * Create prices command handler
 * No subcommands
 */
export function createPricesHandler(deps: PricesHandlerDeps): CommandHandler {
  const { getPrices, formatter } = deps;

  return async (): Promise<UIResponse> => {
    const result = await getPrices.execute();
    return formatter.format(result);
  };
}

/**
 * Create swap command handler
 * Subcommands: quote <amount> [asset], simulate <amount> [asset], execute <amount> [asset]
 */
export function createSwapHandler(deps: SwapHandlerDeps): CommandHandler {
  const {
    getQuote,
    simulateSwap,
    executeSwap,
    quoteFormatter,
    simulateFormatter,
    swapFormatter,
  } = deps;

  return async (args: string[], telegramId: number): Promise<UIResponse> => {
    const subcommand = args[0]?.toLowerCase();

    // /swap without args - show usage
    if (!subcommand) {
      return swapFormatter.formatUnifiedUsage();
    }

    // /swap quote <amount> [asset]
    if (subcommand === "quote") {
      const amountStr = args[1];
      if (!amountStr) {
        return quoteFormatter.formatUsage();
      }
      const amount = parseFloat(amountStr);
      const asset = args[2] || "SOL";
      const result = await getQuote.execute(amount, asset);
      return quoteFormatter.format(result);
    }

    // /swap simulate <amount> [asset]
    if (subcommand === "simulate") {
      const amountStr = args[1];
      if (!amountStr) {
        return simulateFormatter.formatUsage();
      }
      const amount = parseFloat(amountStr);
      const asset = args[2] || "SOL";
      const result = await simulateSwap.execute(telegramId, amount, asset);
      return simulateFormatter.format(result);
    }

    // /swap execute <amount> [asset]
    if (subcommand === "execute") {
      const amountStr = args[1];
      if (!amountStr) {
        return swapFormatter.formatUsage();
      }
      const amount = parseFloat(amountStr);
      const asset = args[2] || "SOL";
      const result = await executeSwap.execute(telegramId, amount, asset);
      return swapFormatter.format(result);
    }

    return swapFormatter.formatUnifiedUsage();
  };
}
