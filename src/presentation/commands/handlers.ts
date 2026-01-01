/**
 * Command factories
 *
 * Each factory creates a Command with its specific dependencies.
 * Commands can have handlers, subcommands, and callbacks.
 */

import { Command, CommandRegistry } from "./types.js";
import type { UserRole } from "../../domain/models/AuthorizedUser.js";
import { RoleGuard } from "../protocol/gateway/RoleGuard.js";
import { HelpFormatter } from "../formatters/index.js";
import { Definitions } from "./definitions.js";

// Use cases
import {
  InitUserUseCase,
  GetWalletInfoUseCase,
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
  DeleteUserDataUseCase,
  AddAuthorizedUserUseCase,
  GetAllAuthorizedUsersUseCase,
  UpdateUserRoleUseCase,
} from "../../domain/usecases/index.js";

// Services
import { UserResolver } from "../telegram/UserResolver.js";
import type { ImportSessionRepository } from "../../domain/repositories/index.js";

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
  ProgressFormatter,
  parseRole,
} from "../formatters/index.js";

// Protocol types
import { StreamItem } from "../protocol/types.js";

// Domain types
import type { PurchaseResult } from "../../domain/usecases/types.js";
import type { SwapResult } from "../../domain/models/SwapStep.js";

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
  getWalletInfo: GetWalletInfoUseCase;
  createWallet: CreateWalletUseCase;
  importWallet: ImportWalletUseCase;
  deleteWallet: DeleteWalletUseCase;
  exportWalletKey: ExportWalletKeyUseCase;
  formatter: DcaWalletFormatter;
  importSessionStore: ImportSessionRepository;
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
  progressFormatter: ProgressFormatter;
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
  progressFormatter: ProgressFormatter;
}

export interface AdminCommandDeps {
  addAuthorizedUser: AddAuthorizedUserUseCase;
  getAllAuthorizedUsers: GetAllAuthorizedUsersUseCase;
  updateUserRole: UpdateUserRoleUseCase;
  formatter: AdminFormatter;
  userResolver: UserResolver;
  deleteUserData: DeleteUserDataUseCase;
  version: string;
  generateInvite?: GenerateInviteUseCase;
  inviteFormatter?: InviteFormatter;
}

export interface StartCommandDeps {
  initUser: InitUserUseCase;
  activateInvite?: ActivateInviteUseCase;
  inviteFormatter?: InviteFormatter;
}

export interface VersionCommandDeps {
  version: string;
  formatter: AdminFormatter;
}

/**
 * External dependencies for help command (passed from DI container)
 * getRegistry is added by registry itself to break circular dependency
 */
export interface HelpCommandExternalDeps {
  helpFormatter: HelpFormatter;
}

export interface HelpCommandDeps extends HelpCommandExternalDeps {
  getRegistry: () => CommandRegistry;
}

// ============================================================
// Wallet subcommand factories
// ============================================================

function createWalletCreateCommand(deps: WalletCommandDeps): Command {
  return {
    definition: { name: "create", description: "Create new wallet" },
    handler: async (_args, ctx) => {
      const result = await deps.createWallet.execute(ctx.telegramId);
      return deps.formatter.formatCreateWallet(result);
    },
  };
}

function createWalletImportCommand(deps: WalletCommandDeps): Command {
  return {
    definition: { name: "import", description: "Import wallet via secure web form" },
    handler: async (_args, ctx) => {
      const url = deps.importSessionStore.store(ctx.telegramId);
      const ttlMinutes = deps.importSessionStore.getTtlMinutes();
      return deps.formatter.formatImportLink(url, ttlMinutes);
    },
  };
}

function createWalletExportCommand(deps: WalletCommandDeps): Command {
  return {
    definition: { name: "export", description: "Export private key" },
    handler: async (_args, ctx) => {
      const result = await deps.exportWalletKey.execute(ctx.telegramId);
      return deps.formatter.formatExportKey(result);
    },
  };
}

function createWalletDeleteCommand(deps: WalletCommandDeps): Command {
  return {
    definition: { name: "delete", description: "Delete wallet" },
    handler: async (_args, ctx) => {
      const result = await deps.deleteWallet.execute(ctx.telegramId);
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
    handler: async (_args, ctx) => {
      const result = await deps.getWalletInfo.execute(ctx.telegramId);
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
    handler: async (_args, ctx) => {
      const result = await deps.startDca.execute(ctx.telegramId);
      return deps.formatter.formatStart(result);
    },
  };
}

function createDcaStopCommand(deps: DcaCommandDeps): Command {
  return {
    definition: { name: "stop", description: "Stop automatic purchases" },
    handler: async (_args, ctx) => {
      const result = await deps.stopDca.execute(ctx.telegramId);
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
    handler: async (_args, ctx) => {
      const result = await deps.getDcaStatus.execute(ctx.telegramId);
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
    handler: async (_args, ctx) => {
      if (!deps.getPortfolioStatus) {
        return deps.portfolioFormatter.formatStatus({ type: "unavailable" });
      }
      const result = await deps.getPortfolioStatus.execute(ctx.telegramId);
      return deps.portfolioFormatter.formatStatus(result);
    },
  };
}

function createPortfolioBuyCommand(deps: PortfolioCommandDeps): Command {
  return {
    definition: { name: "buy", description: "Buy asset for USDC amount", usage: "<amount>" },
    // Fallback handler for non-streaming contexts
    handler: async (args, ctx) => {
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
      // Collect result from streaming execute
      let result: PurchaseResult = { type: "unavailable" };
      for await (const step of deps.executePurchase.execute(ctx.telegramId, amount)) {
        if (step.step === "completed") {
          result = step.result;
        }
      }
      return deps.purchaseFormatter.format(result);
    },
    // Streaming handler for progress updates
    streamingHandler: async function* (args, ctx): AsyncGenerator<StreamItem> {
      if (!deps.executePurchase) {
        yield {
          response: deps.purchaseFormatter.format({ type: "unavailable" }),
          mode: "final",
        };
        return;
      }
      const amountStr = args[0];
      if (!amountStr) {
        yield { response: deps.purchaseFormatter.formatUsage(), mode: "final" };
        return;
      }
      const amount = parseAmount(amountStr);
      if (amount === null) {
        yield { response: deps.purchaseFormatter.formatUsage(), mode: "final" };
        return;
      }

      // Stream progress from use case
      for await (const step of deps.executePurchase.execute(ctx.telegramId, amount)) {
        if (step.step === "completed") {
          yield {
            response: deps.purchaseFormatter.format(step.result),
            mode: "final",
          };
        } else {
          const formatted = deps.progressFormatter.formatPurchaseStep(step);
          yield { response: formatted.response, mode: formatted.mode };
        }
      }
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
    handler: async (_args, ctx) => {
      if (!deps.getPortfolioStatus) {
        return deps.portfolioFormatter.formatStatus({ type: "unavailable" });
      }
      const result = await deps.getPortfolioStatus.execute(ctx.telegramId);
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
    handler: async (_args, _ctx) => {
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
    definition: { name: "quote", description: "Get quote for swap", usage: "<amount> [asset]" },
    handler: async (args, _ctx) => {
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
    definition: { name: "simulate", description: "Simulate swap without executing", usage: "<amount> [asset]" },
    handler: async (args, ctx) => {
      const amountStr = args[0];
      if (!amountStr) {
        return deps.simulateFormatter.formatUsage();
      }
      const amount = parseAmount(amountStr);
      if (amount === null) {
        return deps.simulateFormatter.formatUsage();
      }
      const asset = args[1] || "SOL";
      const result = await deps.simulateSwap.execute(ctx.telegramId, amount, asset);
      return deps.simulateFormatter.format(result);
    },
  };
}

function createSwapExecuteCommand(deps: SwapCommandDeps): Command {
  return {
    definition: { name: "execute", description: "Execute real swap", usage: "<amount> [asset]" },
    // Fallback handler for non-streaming contexts
    handler: async (args, ctx) => {
      const amountStr = args[0];
      if (!amountStr) {
        return deps.swapFormatter.formatUsage();
      }
      const amount = parseAmount(amountStr);
      if (amount === null) {
        return deps.swapFormatter.formatUsage();
      }
      const asset = args[1] || "SOL";
      // Collect result from streaming execute
      let result: SwapResult = { status: "unavailable" };
      for await (const step of deps.executeSwap.execute(ctx.telegramId, amount, asset)) {
        if (step.step === "completed") {
          result = step.result;
        }
      }
      return deps.swapFormatter.format(result);
    },
    // Streaming handler for progress updates
    streamingHandler: async function* (args, ctx): AsyncGenerator<StreamItem> {
      const amountStr = args[0];
      if (!amountStr) {
        yield { response: deps.swapFormatter.formatUsage(), mode: "final" };
        return;
      }
      const amount = parseAmount(amountStr);
      if (amount === null) {
        yield { response: deps.swapFormatter.formatUsage(), mode: "final" };
        return;
      }
      const asset = args[1] || "SOL";

      // Stream progress from use case
      for await (const step of deps.executeSwap.execute(ctx.telegramId, amount, asset)) {
        if (step.step === "completed") {
          yield {
            response: deps.swapFormatter.format(step.result),
            mode: "final",
          };
        } else {
          const formatted = deps.progressFormatter.formatSwapStep(step);
          yield { response: formatted.response, mode: formatted.mode };
        }
      }
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
    handler: async (_args, _ctx) => {
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
    definition: { name: "add", description: "Add authorized user", usage: "<user_id> [role]" },
    handler: async (args, ctx) => {
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

      const result = await deps.addAuthorizedUser.execute(ctx.telegramId, targetId, role);
      return deps.formatter.formatResult(result);
    },
  };
}

function createAdminRemoveCommand(deps: AdminCommandDeps): Command {
  return {
    definition: { name: "remove", description: "Remove authorized user", usage: "<user_id>" },
    handler: async (args, ctx) => {
      const idStr = args[0];
      if (!idStr) {
        return deps.formatter.formatRemoveUsage();
      }

      const resolveResult = await deps.userResolver.resolve(idStr);
      if (!resolveResult.success || !resolveResult.telegramId) {
        return deps.formatter.formatResolveError(idStr, resolveResult.error);
      }
      const targetId = resolveResult.telegramId;

      const result = await deps.deleteUserData.execute(ctx.telegramId, targetId);
      return deps.formatter.formatResult(result);
    },
  };
}

function createAdminListCommand(deps: AdminCommandDeps): Command {
  return {
    definition: { name: "list", description: "List all authorized users" },
    handler: async (_args, _ctx) => {
      const result = await deps.getAllAuthorizedUsers.execute();
      return deps.formatter.formatUserList(result.users);
    },
  };
}

function createAdminRoleCommand(deps: AdminCommandDeps): Command {
  return {
    definition: { name: "role", description: "Change user role", usage: "<user_id> <role>" },
    handler: async (args, ctx) => {
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

      const result = await deps.updateUserRole.execute(ctx.telegramId, targetId, role);
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
    definition: { name: "invite", description: "Create invite link", usage: "[role]" },
    handler: async (args, ctx) => {
      const roleStr = args[0] || "user";
      const role = parseRole(roleStr);
      if (!role) {
        return inviteFormatter.formatUsage();
      }

      const result = await generateInvite.execute(ctx.telegramId, role);
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
    handler: async (_args, _ctx) => {
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
    handler: async (args, ctx) => {
      const param = args[0];

      // Check for invite token parameter (inv_<token>)
      if (param?.startsWith("inv_") && deps.activateInvite && deps.inviteFormatter) {
        const token = param.slice(4); // Remove "inv_" prefix
        const result = await deps.activateInvite.execute(token, ctx.telegramId);
        return deps.inviteFormatter.formatActivateResult(result);
      }

      // Check if user is authorized (role comes from ctx, loaded by LoadRolePlugin)
      if (ctx.role === "guest") {
        return { text: "You need an invite link to use this bot." };
      }

      // Initialize user (for authorized users)
      await deps.initUser.execute(ctx.telegramId);

      let text = "**CMI DCA Bot**\n\n";
      text += "Target allocations:\n";
      text += "- BTC: 40%\n";
      text += "- ETH: 30%\n";
      text += "- SOL: 30%\n\n";
      text += "The bot purchases the asset furthest below its target allocation.\n\n";
      text += "Use /help to see available commands.";

      return { text };
    },
  };
}

// ============================================================
// Version command factory
// ============================================================

export function createVersionCommand(deps: VersionCommandDeps): Command {
  return {
    definition: Definitions.version,
    requiredRole: "admin",
    handler: async (_args, _ctx) => {
      return deps.formatter.formatVersion(deps.version);
    },
  };
}

// ============================================================
// Help command factory
// ============================================================

/**
 * Filter commands by user role.
 * Returns only commands the user has access to.
 */
function filterCommandsByRole(
  commands: Map<string, Command>,
  role: UserRole,
): Map<string, Command> {
  const filtered = new Map<string, Command>();
  for (const [name, cmd] of commands) {
    if (RoleGuard.canAccess(role, cmd.requiredRole)) {
      filtered.set(name, cmd);
    }
  }
  return filtered;
}

export function createHelpCommand(deps: HelpCommandDeps): Command {
  return {
    definition: Definitions.help,
    requiredRole: "guest",
    handler: async (_args, ctx) => {
      const allCommands = deps.getRegistry().getCommands();
      const filtered = filterCommandsByRole(allCommands, ctx.role);
      const modeInfo = deps.getRegistry().getModeInfo();
      return { text: deps.helpFormatter.formatHelp(filtered, modeInfo) };
    },
  };
}
