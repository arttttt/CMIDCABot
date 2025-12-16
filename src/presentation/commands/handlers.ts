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
// Wallet subcommand factories
// ============================================================

function createWalletCreateCommand(deps: WalletCommandDeps): Command {
  return {
    definition: { name: "create", description: "Create new wallet" },
    handler: async (_args, telegramId) => {
      const result = await deps.createWallet.execute(telegramId);
      return deps.formatter.formatCreateWallet(result);
    },
  };
}

function createWalletImportCommand(deps: WalletCommandDeps): Command {
  return {
    definition: { name: "import", description: "Import wallet from private key" },
    handler: async (args, telegramId) => {
      const privateKey = args[0];
      if (!privateKey) {
        return deps.formatter.formatImportUsage();
      }
      const result = await deps.importWallet.execute(telegramId, privateKey);
      return deps.formatter.formatImportWallet(result);
    },
  };
}

function createWalletExportCommand(deps: WalletCommandDeps): Command {
  const commandPath = "wallet/export";

  return {
    definition: { name: "export", description: "Export private key" },
    handler: async (_args, telegramId) => {
      const result = await deps.exportWalletKey.execute(telegramId);
      return deps.formatter.formatExportKey(result, commandPath);
    },
    callbacks: new Map([
      [
        "confirm_export",
        async (telegramId) => {
          const result = await deps.exportWalletKey.execute(telegramId);
          return deps.formatter.formatExportKeyConfirmed(result);
        },
      ],
    ]),
  };
}

function createWalletDeleteCommand(deps: WalletCommandDeps): Command {
  return {
    definition: { name: "delete", description: "Delete wallet" },
    handler: async (_args, telegramId) => {
      const result = await deps.deleteWallet.execute(telegramId);
      return deps.formatter.formatDeleteWallet(result);
    },
  };
}

// ============================================================
// Wallet command factory
// ============================================================

export function createWalletCommand(deps: WalletCommandDeps): Command {
  return {
    definition: Definitions.wallet,
    handler: async (_args, telegramId) => {
      const result = await deps.showWallet.execute(telegramId);
      return deps.formatter.formatShowWallet(result);
    },
    subcommands: new Map([
      ["create", createWalletCreateCommand(deps)],
      ["import", createWalletImportCommand(deps)],
      ["export", createWalletExportCommand(deps)],
      ["delete", createWalletDeleteCommand(deps)],
    ]),
  };
}

// ============================================================
// DCA subcommand factories
// ============================================================

function createDcaStartCommand(deps: DcaCommandDeps): Command {
  return {
    definition: { name: "start", description: "Start automatic purchases" },
    handler: async (_args, telegramId) => {
      const result = await deps.startDca.execute(telegramId);
      return deps.formatter.formatStart(result);
    },
  };
}

function createDcaStopCommand(deps: DcaCommandDeps): Command {
  return {
    definition: { name: "stop", description: "Stop automatic purchases" },
    handler: async (_args, telegramId) => {
      const result = await deps.stopDca.execute(telegramId);
      return deps.formatter.formatStop(result);
    },
  };
}

// ============================================================
// DCA command factory
// ============================================================

export function createDcaCommand(deps: DcaCommandDeps): Command {
  return {
    definition: Definitions.dca,
    handler: async (_args, telegramId) => {
      const result = await deps.getDcaStatus.execute(telegramId);
      return deps.formatter.formatStatus(result);
    },
    subcommands: new Map([
      ["start", createDcaStartCommand(deps)],
      ["stop", createDcaStopCommand(deps)],
    ]),
  };
}

// ============================================================
// Portfolio subcommand factories
// ============================================================

function createPortfolioStatusCommand(deps: PortfolioCommandDeps): Command {
  return {
    definition: { name: "status", description: "Show portfolio status" },
    handler: async (_args, telegramId) => {
      const result = await deps.getPortfolioStatus.execute(telegramId);
      return deps.portfolioFormatter.formatStatus(result);
    },
  };
}

function createPortfolioBuyCommand(deps: PortfolioCommandDeps): Command {
  return {
    definition: { name: "buy", description: "Buy asset for USDC amount" },
    handler: async (args, telegramId) => {
      const amountStr = args[0];
      if (!amountStr) {
        return deps.purchaseFormatter.formatUsage();
      }
      const amount = parseFloat(amountStr);
      const result = await deps.executePurchase.execute(telegramId, amount);
      return deps.purchaseFormatter.format(result);
    },
  };
}

// ============================================================
// Portfolio command factory
// ============================================================

export function createPortfolioCommand(deps: PortfolioCommandDeps): Command {
  return {
    definition: Definitions.portfolio,
    handler: async (_args, telegramId) => {
      const result = await deps.getPortfolioStatus.execute(telegramId);
      return deps.portfolioFormatter.formatStatus(result);
    },
    subcommands: new Map([
      ["status", createPortfolioStatusCommand(deps)],
      ["buy", createPortfolioBuyCommand(deps)],
    ]),
  };
}

// ============================================================
// Prices command factory (no subcommands)
// ============================================================

export function createPricesCommand(deps: PricesCommandDeps): Command {
  return {
    definition: Definitions.prices,
    handler: async () => {
      const result = await deps.getPrices.execute();
      return deps.formatter.format(result);
    },
  };
}

// ============================================================
// Swap subcommand factories
// ============================================================

function createSwapQuoteCommand(deps: SwapCommandDeps): Command {
  return {
    definition: { name: "quote", description: "Get quote for swap" },
    handler: async (args) => {
      const amountStr = args[0];
      if (!amountStr) {
        return deps.quoteFormatter.formatUsage();
      }
      const amount = parseFloat(amountStr);
      const asset = args[1] || "SOL";
      const result = await deps.getQuote.execute(amount, asset);
      return deps.quoteFormatter.format(result);
    },
  };
}

function createSwapSimulateCommand(deps: SwapCommandDeps): Command {
  return {
    definition: { name: "simulate", description: "Simulate swap without executing" },
    handler: async (args, telegramId) => {
      const amountStr = args[0];
      if (!amountStr) {
        return deps.simulateFormatter.formatUsage();
      }
      const amount = parseFloat(amountStr);
      const asset = args[1] || "SOL";
      const result = await deps.simulateSwap.execute(telegramId, amount, asset);
      return deps.simulateFormatter.format(result);
    },
  };
}

function createSwapExecuteCommand(deps: SwapCommandDeps): Command {
  return {
    definition: { name: "execute", description: "Execute real swap" },
    handler: async (args, telegramId) => {
      const amountStr = args[0];
      if (!amountStr) {
        return deps.swapFormatter.formatUsage();
      }
      const amount = parseFloat(amountStr);
      const asset = args[1] || "SOL";
      const result = await deps.executeSwap.execute(telegramId, amount, asset);
      return deps.swapFormatter.format(result);
    },
  };
}

// ============================================================
// Swap command factory
// ============================================================

export function createSwapCommand(deps: SwapCommandDeps): Command {
  return {
    definition: Definitions.swap,
    handler: async () => {
      return deps.swapFormatter.formatUnifiedUsage();
    },
    subcommands: new Map([
      ["quote", createSwapQuoteCommand(deps)],
      ["simulate", createSwapSimulateCommand(deps)],
      ["execute", createSwapExecuteCommand(deps)],
    ]),
  };
}
