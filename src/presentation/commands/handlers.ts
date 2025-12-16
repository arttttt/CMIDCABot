/**
 * Command factories
 *
 * Each factory creates a Command with its specific dependencies.
 * Commands can have handlers, subcommands, and callbacks.
 */

import { Command } from "./types.js";
import { Definitions } from "./definitions.js";

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

export interface WalletCommandDeps {
  showWallet: ShowWalletUseCase;
  createWallet: CreateWalletUseCase;
  importWallet: ImportWalletUseCase;
  deleteWallet: DeleteWalletUseCase;
  exportWalletKey: ExportWalletKeyUseCase;
  formatter: DcaWalletFormatter;
}

export interface DcaCommandDeps {
  startDca: StartDcaUseCase;
  stopDca: StopDcaUseCase;
  getDcaStatus: GetDcaStatusUseCase;
  formatter: DcaFormatter;
}

export interface PortfolioCommandDeps {
  getPortfolioStatus: GetPortfolioStatusUseCase;
  executePurchase: ExecutePurchaseUseCase;
  portfolioFormatter: PortfolioFormatter;
  purchaseFormatter: PurchaseFormatter;
}

export interface PricesCommandDeps {
  getPrices: GetPricesUseCase;
  formatter: PriceFormatter;
}

export interface SwapCommandDeps {
  getQuote: GetQuoteUseCase;
  simulateSwap: SimulateSwapUseCase;
  executeSwap: ExecuteSwapUseCase;
  quoteFormatter: QuoteFormatter;
  simulateFormatter: SimulateFormatter;
  swapFormatter: SwapFormatter;
}

// ============================================================
// Command factories
// ============================================================

/**
 * Create wallet command with subcommands
 */
export function createWalletCommand(deps: WalletCommandDeps): Command {
  const { showWallet, createWallet, importWallet, deleteWallet, exportWalletKey, formatter } = deps;

  return {
    definition: Definitions.wallet,

    // Default handler: /wallet - show wallet
    handler: async (_args, telegramId) => {
      const result = await showWallet.execute(telegramId);
      return formatter.formatShowWallet(result);
    },

    subcommands: new Map([
      [
        "create",
        {
          definition: { name: "create", description: "Create new wallet" },
          handler: async (_args, telegramId) => {
            const result = await createWallet.execute(telegramId);
            return formatter.formatCreateWallet(result);
          },
        },
      ],
      [
        "import",
        {
          definition: { name: "import", description: "Import wallet from private key" },
          handler: async (args, telegramId) => {
            const privateKey = args[0];
            if (!privateKey) {
              return formatter.formatImportUsage();
            }
            const result = await importWallet.execute(telegramId, privateKey);
            return formatter.formatImportWallet(result);
          },
        },
      ],
      [
        "export",
        {
          definition: { name: "export", description: "Export private key" },
          handler: async (_args, telegramId) => {
            const result = await exportWalletKey.execute(telegramId);
            return formatter.formatExportKey(result);
          },
          callbacks: new Map([
            [
              "confirm_export",
              async (telegramId) => {
                const result = await exportWalletKey.execute(telegramId);
                return formatter.formatExportKeyConfirmed(result);
              },
            ],
          ]),
        },
      ],
      [
        "delete",
        {
          definition: { name: "delete", description: "Delete wallet" },
          handler: async (_args, telegramId) => {
            const result = await deleteWallet.execute(telegramId);
            return formatter.formatDeleteWallet(result);
          },
        },
      ],
    ]),
  };
}

/**
 * Create DCA command with subcommands
 */
export function createDcaCommand(deps: DcaCommandDeps): Command {
  const { startDca, stopDca, getDcaStatus, formatter } = deps;

  return {
    definition: Definitions.dca,

    // Default handler: /dca - show status
    handler: async (_args, telegramId) => {
      const result = await getDcaStatus.execute(telegramId);
      return formatter.formatStatus(result);
    },

    subcommands: new Map([
      [
        "start",
        {
          definition: { name: "start", description: "Start automatic purchases" },
          handler: async (_args, telegramId) => {
            const result = await startDca.execute(telegramId);
            return formatter.formatStart(result);
          },
        },
      ],
      [
        "stop",
        {
          definition: { name: "stop", description: "Stop automatic purchases" },
          handler: async (_args, telegramId) => {
            const result = await stopDca.execute(telegramId);
            return formatter.formatStop(result);
          },
        },
      ],
    ]),
  };
}

/**
 * Create portfolio command with subcommands
 */
export function createPortfolioCommand(deps: PortfolioCommandDeps): Command {
  const { getPortfolioStatus, executePurchase, portfolioFormatter, purchaseFormatter } = deps;

  return {
    definition: Definitions.portfolio,

    // Default handler: /portfolio - show status
    handler: async (_args, telegramId) => {
      const result = await getPortfolioStatus.execute(telegramId);
      return portfolioFormatter.formatStatus(result);
    },

    subcommands: new Map([
      [
        "status",
        {
          definition: { name: "status", description: "Show portfolio status" },
          handler: async (_args, telegramId) => {
            const result = await getPortfolioStatus.execute(telegramId);
            return portfolioFormatter.formatStatus(result);
          },
        },
      ],
      [
        "buy",
        {
          definition: { name: "buy", description: "Buy asset for USDC amount" },
          handler: async (args, telegramId) => {
            const amountStr = args[0];
            if (!amountStr) {
              return purchaseFormatter.formatUsage();
            }
            const amount = parseFloat(amountStr);
            const result = await executePurchase.execute(telegramId, amount);
            return purchaseFormatter.format(result);
          },
        },
      ],
    ]),
  };
}

/**
 * Create prices command (no subcommands)
 */
export function createPricesCommand(deps: PricesCommandDeps): Command {
  const { getPrices, formatter } = deps;

  return {
    definition: Definitions.prices,

    handler: async () => {
      const result = await getPrices.execute();
      return formatter.format(result);
    },
  };
}

/**
 * Create swap command with subcommands
 */
export function createSwapCommand(deps: SwapCommandDeps): Command {
  const { getQuote, simulateSwap, executeSwap, quoteFormatter, simulateFormatter, swapFormatter } =
    deps;

  return {
    definition: Definitions.swap,

    // Default handler: /swap - show usage
    handler: async () => {
      return swapFormatter.formatUnifiedUsage();
    },

    subcommands: new Map([
      [
        "quote",
        {
          definition: { name: "quote", description: "Get quote for swap" },
          handler: async (args) => {
            const amountStr = args[0];
            if (!amountStr) {
              return quoteFormatter.formatUsage();
            }
            const amount = parseFloat(amountStr);
            const asset = args[1] || "SOL";
            const result = await getQuote.execute(amount, asset);
            return quoteFormatter.format(result);
          },
        },
      ],
      [
        "simulate",
        {
          definition: { name: "simulate", description: "Simulate swap without executing" },
          handler: async (args, telegramId) => {
            const amountStr = args[0];
            if (!amountStr) {
              return simulateFormatter.formatUsage();
            }
            const amount = parseFloat(amountStr);
            const asset = args[1] || "SOL";
            const result = await simulateSwap.execute(telegramId, amount, asset);
            return simulateFormatter.format(result);
          },
        },
      ],
      [
        "execute",
        {
          definition: { name: "execute", description: "Execute real swap" },
          handler: async (args, telegramId) => {
            const amountStr = args[0];
            if (!amountStr) {
              return swapFormatter.formatUsage();
            }
            const amount = parseFloat(amountStr);
            const asset = args[1] || "SOL";
            const result = await executeSwap.execute(telegramId, amount, asset);
            return swapFormatter.format(result);
          },
        },
      ],
    ]),
  };
}
