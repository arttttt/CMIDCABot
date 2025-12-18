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
  InitUserUseCase,
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
  GenerateInviteUseCase,
  ActivateInviteUseCase,
} from "../../domain/usecases/index.js";

// Services
import { AuthorizationService } from "../../services/authorization.js";
import { UserResolver } from "../../services/userResolver.js";

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
  AdminFormatter,
  InviteFormatter,
  parseRole,
} from "../formatters/index.js";

// ============================================================
// Helper functions
// ============================================================

/**
 * Safely parse a string to a positive number.
 * Returns null if the input is not a valid positive number.
 *
 * Security: Validates parseFloat result immediately to prevent
 * NaN propagation through the system (LOW-001).
 */
function parseAmount(amountStr: string): number | null {
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return null;
  }
  return amount;
}

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
  getPortfolioStatus: GetPortfolioStatusUseCase | undefined;
  executePurchase: ExecutePurchaseUseCase | undefined;
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

export interface AdminCommandDeps {
  authService: AuthorizationService;
  formatter: AdminFormatter;
  userResolver: UserResolver;
  generateInvite?: GenerateInviteUseCase;
  inviteFormatter?: InviteFormatter;
}

export interface StartCommandDeps {
  initUser: InitUserUseCase;
  authService: AuthorizationService;
  activateInvite?: ActivateInviteUseCase;
  inviteFormatter?: InviteFormatter;
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
    requiredRole: "user",
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
    requiredRole: "user",
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
      if (!deps.getPortfolioStatus) {
        return deps.portfolioFormatter.formatStatus({ type: "unavailable" });
      }
      const result = await deps.getPortfolioStatus.execute(telegramId);
      return deps.portfolioFormatter.formatStatus(result);
    },
  };
}

function createPortfolioBuyCommand(deps: PortfolioCommandDeps): Command {
  return {
    definition: { name: "buy", description: "Buy asset for USDC amount" },
    handler: async (args, telegramId) => {
      if (!deps.executePurchase) {
        return deps.purchaseFormatter.format({ type: "unavailable" });
      }
      const amountStr = args[0];
      if (!amountStr) {
        return deps.purchaseFormatter.formatUsage();
      }
      const amount = parseAmount(amountStr);
      if (amount === null) {
        return deps.purchaseFormatter.formatUsage();
      }
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
    requiredRole: "user",
    handler: async (_args, telegramId) => {
      if (!deps.getPortfolioStatus) {
        return deps.portfolioFormatter.formatStatus({ type: "unavailable" });
      }
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
    requiredRole: "user",
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
      const amount = parseAmount(amountStr);
      if (amount === null) {
        return deps.quoteFormatter.formatUsage();
      }
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
      const amount = parseAmount(amountStr);
      if (amount === null) {
        return deps.simulateFormatter.formatUsage();
      }
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
      const amount = parseAmount(amountStr);
      if (amount === null) {
        return deps.swapFormatter.formatUsage();
      }
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
    requiredRole: "user",
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

// ============================================================
// Admin subcommand factories
// ============================================================

function createAdminAddCommand(deps: AdminCommandDeps): Command {
  return {
    definition: { name: "add", description: "Add authorized user" },
    handler: async (args, telegramId) => {
      const idStr = args[0];
      if (!idStr) {
        return deps.formatter.formatAddUsage();
      }

      const resolveResult = await deps.userResolver.resolve(idStr);
      if (!resolveResult.success || !resolveResult.telegramId) {
        return deps.formatter.formatResolveError(idStr, resolveResult.error);
      }
      const targetId = resolveResult.telegramId;

      const roleStr = args[1] || "user";
      const role = parseRole(roleStr);
      if (!role) {
        return deps.formatter.formatInvalidRole(roleStr);
      }

      const result = await deps.authService.addUser(telegramId, targetId, role);
      return deps.formatter.formatResult(result);
    },
  };
}

function createAdminRemoveCommand(deps: AdminCommandDeps): Command {
  return {
    definition: { name: "remove", description: "Remove authorized user" },
    handler: async (args, telegramId) => {
      const idStr = args[0];
      if (!idStr) {
        return deps.formatter.formatRemoveUsage();
      }

      const resolveResult = await deps.userResolver.resolve(idStr);
      if (!resolveResult.success || !resolveResult.telegramId) {
        return deps.formatter.formatResolveError(idStr, resolveResult.error);
      }
      const targetId = resolveResult.telegramId;

      const result = await deps.authService.removeUser(telegramId, targetId);
      return deps.formatter.formatResult(result);
    },
  };
}

function createAdminListCommand(deps: AdminCommandDeps): Command {
  return {
    definition: { name: "list", description: "List all authorized users" },
    handler: async () => {
      const users = await deps.authService.getAllUsers();
      return deps.formatter.formatUserList(users);
    },
  };
}

function createAdminRoleCommand(deps: AdminCommandDeps): Command {
  return {
    definition: { name: "role", description: "Change user role" },
    handler: async (args, telegramId) => {
      const idStr = args[0];
      const roleStr = args[1];

      if (!idStr || !roleStr) {
        return deps.formatter.formatRoleUsage();
      }

      const resolveResult = await deps.userResolver.resolve(idStr);
      if (!resolveResult.success || !resolveResult.telegramId) {
        return deps.formatter.formatResolveError(idStr, resolveResult.error);
      }
      const targetId = resolveResult.telegramId;

      const role = parseRole(roleStr);
      if (!role) {
        return deps.formatter.formatInvalidRole(roleStr);
      }

      const result = await deps.authService.updateRole(telegramId, targetId, role);
      return deps.formatter.formatResult(result);
    },
  };
}

function createAdminInviteCommand(deps: AdminCommandDeps): Command | undefined {
  if (!deps.generateInvite || !deps.inviteFormatter) {
    return undefined;
  }

  const generateInvite = deps.generateInvite;
  const inviteFormatter = deps.inviteFormatter;

  return {
    definition: { name: "invite", description: "Create invite link" },
    handler: async (args, telegramId) => {
      const roleStr = args[0] || "user";
      const role = parseRole(roleStr);
      if (!role) {
        return inviteFormatter.formatUsage();
      }

      const result = await generateInvite.execute(telegramId, role);
      return inviteFormatter.formatGenerateResult(result);
    },
  };
}

// ============================================================
// Admin command factory
// ============================================================

export function createAdminCommand(deps: AdminCommandDeps): Command {
  const subcommands = new Map<string, Command>([
    ["add", createAdminAddCommand(deps)],
    ["remove", createAdminRemoveCommand(deps)],
    ["list", createAdminListCommand(deps)],
    ["role", createAdminRoleCommand(deps)],
  ]);

  // Add invite command if dependencies are available
  const inviteCmd = createAdminInviteCommand(deps);
  if (inviteCmd) {
    subcommands.set("invite", inviteCmd);
  }

  return {
    definition: Definitions.admin,
    requiredRole: "admin",
    handler: async () => {
      return deps.formatter.formatHelp(!!inviteCmd);
    },
    subcommands,
  };
}

// ============================================================
// Start command factory
// ============================================================

export function createStartCommand(deps: StartCommandDeps): Command {
  return {
    definition: Definitions.start,
    requiredRole: "guest",
    handler: async (args, telegramId) => {
      const param = args[0];

      // Check for invite token parameter (inv_<token>)
      if (param?.startsWith("inv_") && deps.activateInvite && deps.inviteFormatter) {
        const token = param.slice(4); // Remove "inv_" prefix
        const result = await deps.activateInvite.execute(token, telegramId);
        return deps.inviteFormatter.formatActivateResult(result);
      }

      // Check if user is authorized
      const role = await deps.authService.getRole(telegramId);
      if (!role) {
        return { text: "You need an invite link to use this bot." };
      }

      // Initialize user (for authorized users)
      await deps.initUser.execute(telegramId);
      return { text: "Welcome! Use /help to see available commands." };
    },
  };
}
