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
  DetermineAssetToBuyUseCase,
  GetPricesUseCase,
  GetQuoteUseCase,
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
import type {
  ImportSessionRepository,
  ConfirmationRepository,
  SwapRepository,
} from "../../domain/repositories/index.js";

// Formatters
import {
  DcaWalletFormatter,
  DcaFormatter,
  PortfolioFormatter,
  PurchaseFormatter,
  PriceFormatter,
  QuoteFormatter,
  SwapFormatter,
  AdminFormatter,
  InviteFormatter,
  ProgressFormatter,
  ConfirmationFormatter,
  parseRole,
} from "../formatters/index.js";

// Logging
import { logger } from "../../infrastructure/shared/logging/index.js";

// Domain policies
import { SlippagePolicy } from "../../domain/policies/SlippagePolicy.js";

// Protocol types
import { StreamItem } from "../protocol/types.js";
import { StreamUtils } from "../protocol/gateway/stream.js";

// Domain types
import type { PurchaseResult } from "../../domain/usecases/types.js";
import type { SwapResult } from "../../domain/models/SwapStep.js";
import type { AssetSymbol } from "../../types/portfolio.js";
import { ConfirmationSessionId } from "../../domain/models/id/index.js";

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
  determineAssetToBuy: DetermineAssetToBuyUseCase | undefined;
  portfolioFormatter: PortfolioFormatter;
  purchaseFormatter: PurchaseFormatter;
  progressFormatter: ProgressFormatter;
  // Confirmation flow dependencies
  confirmationRepository: ConfirmationRepository | undefined;
  confirmationFormatter: ConfirmationFormatter | undefined;
  swapRepository: SwapRepository | undefined;
}

export interface PricesCommandDeps {
  getPrices: GetPricesUseCase;
  formatter: PriceFormatter;
}

export interface SwapCommandDeps {
  getQuote: GetQuoteUseCase;
  executeSwap: ExecuteSwapUseCase;
  quoteFormatter: QuoteFormatter;
  swapFormatter: SwapFormatter;
  progressFormatter: ProgressFormatter;
  // Confirmation flow dependencies
  confirmationRepository: ConfirmationRepository | undefined;
  confirmationFormatter: ConfirmationFormatter | undefined;
  swapRepository: SwapRepository | undefined;
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
      return deps.formatter.formatGetWalletInfo(result);
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
  const { confirmationRepository, confirmationFormatter, swapRepository, determineAssetToBuy } = deps;

  // Check if confirmation flow is available (needs determineAssetToBuy to get real asset)
  const hasConfirmationFlow =
    confirmationRepository && confirmationFormatter && swapRepository && determineAssetToBuy;

  /**
   * Parse session ID from callback parameter
   */
  function parseSessionId(sessionIdStr: string): ConfirmationSessionId | null {
    try {
      return new ConfirmationSessionId(sessionIdStr);
    } catch {
      return null;
    }
  }

  /**
   * Handle confirm callback - check slippage and execute with streaming progress
   */
  function handleConfirmStream(
    sessionIdStr: string,
    ctx: import("./types.js").CommandExecutionContext,
  ): import("../protocol/types.js").ClientResponseStream {
    return StreamUtils.catchAsync(async () => {
      async function* stream(): import("../protocol/types.js").ClientResponseStream {
        const sessionId = parseSessionId(sessionIdStr);
        if (!sessionId) {
          yield { response: confirmationFormatter!.formatSessionNotFound(), mode: "final" };
          return;
        }

        const session = confirmationRepository!.get(sessionId);
        if (!session) {
          yield { response: confirmationFormatter!.formatSessionNotFound(), mode: "final" };
          return;
        }

        // Check if session belongs to this user
        if (!session.telegramId.equals(ctx.telegramId)) {
          logger.warn("PortfolioBuy", "Session user mismatch", {
            sessionUser: session.telegramId.value,
            requestUser: ctx.telegramId.value,
          });
          yield { response: confirmationFormatter!.formatSessionNotFound(), mode: "final" };
          return;
        }

        // Get fresh quote to check slippage
        let freshQuote;
        try {
          freshQuote = await swapRepository!.getQuoteUsdcToAsset(
            session.amount,
            session.asset as AssetSymbol,
          );
        } catch (error) {
          logger.error("PortfolioBuy", "Failed to get fresh quote", {
            error: error instanceof Error ? error.message : String(error),
          });
          confirmationRepository!.cancel(sessionId);
          yield {
            response: deps.purchaseFormatter.format({
              type: "quote_error",
              error: "Failed to refresh quote",
            }),
            mode: "final",
          };
          return;
        }

        // Check slippage
        if (SlippagePolicy.isExceeded(session.quote, freshQuote)) {
          // Can we re-confirm?
          if (confirmationRepository!.updateQuote(sessionId, freshQuote)) {
            // Show slippage warning with new price
            yield {
              response: confirmationFormatter!.formatSlippageWarning(
                session.type,
                session.quote,
                freshQuote,
                sessionId,
                confirmationRepository!.getTtlSeconds(),
              ),
              mode: "final",
            };
            return;
          } else {
            // Max re-confirms exceeded
            confirmationRepository!.cancel(sessionId);
            yield {
              response: confirmationFormatter!.formatMaxSlippageExceeded(session.type),
              mode: "final",
            };
            return;
          }
        }

        // Slippage OK - consume session and execute
        confirmationRepository!.consume(sessionId);

        // Execute purchase with progress streaming
        for await (const step of deps.executePurchase!.execute(ctx.telegramId, session.amount)) {
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
      }

      return stream();
    }, (error) => {
      logger.error("PortfolioBuy", "Confirm callback failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      const sessionId = parseSessionId(sessionIdStr);
      if (sessionId) {
        confirmationRepository!.cancel(sessionId);
      }
      return deps.purchaseFormatter.format({
        type: "quote_error",
        error: "Failed to execute purchase",
      });
    });
  }

  /**
   * Handle cancel callback
   */
  function handleCancel(
    sessionIdStr: string,
    ctx: import("./types.js").CommandExecutionContext,
  ): import("../protocol/types.js").ClientResponse {
    const sessionId = parseSessionId(sessionIdStr);
    if (!sessionId) {
      return confirmationFormatter!.formatSessionNotFound();
    }

    const session = confirmationRepository!.get(sessionId);

    if (!session) {
      return confirmationFormatter!.formatSessionNotFound();
    }

    // Check if session belongs to this user
    if (!session.telegramId.equals(ctx.telegramId)) {
      logger.warn("PortfolioBuy", "Cancel session user mismatch", {
        sessionUser: session.telegramId.value,
        requestUser: ctx.telegramId.value,
      });
      return confirmationFormatter!.formatSessionNotFound();
    }

    confirmationRepository!.cancel(sessionId);
    return confirmationFormatter!.formatCancelled(session.type);
  }

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

      // With confirmation flow: show preview
      if (hasConfirmationFlow) {
        try {
          // Determine which asset to buy based on portfolio allocation
          const assetInfo = await determineAssetToBuy!.execute(ctx.telegramId);
          if (!assetInfo) {
            return deps.purchaseFormatter.format({ type: "no_wallet" });
          }
          const asset = assetInfo.symbol;

          const quote = await swapRepository!.getQuoteUsdcToAsset(amount, asset);
          const sessionId = confirmationRepository!.store(
            ctx.telegramId,
            "portfolio_buy",
            amount,
            asset,
            quote,
          );
          return confirmationFormatter!.formatPreview(
            "portfolio_buy",
            amount,
            asset,
            quote,
            sessionId,
            confirmationRepository!.getTtlSeconds(),
          );
        } catch (error) {
          logger.error("PortfolioBuy", "Failed to get quote for preview", {
            error: error instanceof Error ? error.message : String(error),
          });
          return deps.purchaseFormatter.format({
            type: "quote_error",
            error: "Failed to get quote",
          });
        }
      }

      // Without confirmation flow: execute directly
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

      // With confirmation flow: show preview (no streaming needed for preview)
      if (hasConfirmationFlow) {
        try {
          // Determine which asset to buy based on portfolio allocation
          const assetInfo = await determineAssetToBuy!.execute(ctx.telegramId);
          if (!assetInfo) {
            yield {
              response: deps.purchaseFormatter.format({ type: "no_wallet" }),
              mode: "final",
            };
            return;
          }
          const asset = assetInfo.symbol;

          const quote = await swapRepository!.getQuoteUsdcToAsset(amount, asset);
          const sessionId = confirmationRepository!.store(
            ctx.telegramId,
            "portfolio_buy",
            amount,
            asset,
            quote,
          );
          yield {
            response: confirmationFormatter!.formatPreview(
              "portfolio_buy",
              amount,
              asset,
              quote,
              sessionId,
              confirmationRepository!.getTtlSeconds(),
            ),
            mode: "final",
          };
          return;
        } catch (error) {
          logger.error("PortfolioBuy", "Failed to get quote for preview", {
            error: error instanceof Error ? error.message : String(error),
          });
          yield {
            response: deps.purchaseFormatter.format({
              type: "quote_error",
              error: "Failed to get quote",
            }),
            mode: "final",
          };
          return;
        }
      }

      // Without confirmation flow: stream progress from use case
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
    callbacks: hasConfirmationFlow
      ? new Map([
          ["confirm", {
            streamingHandler: (ctx, params) => {
              if (params.length === 0) {
                return StreamUtils.final(confirmationFormatter!.formatSessionNotFound());
              }
              return handleConfirmStream(params[0], ctx);
            },
            params: [{ name: "sessionId", maxLength: ConfirmationSessionId.MAX_LENGTH }],
          }],
          ["cancel", {
            handler: async (ctx, params) => {
              if (params.length === 0) {
                return confirmationFormatter!.formatSessionNotFound();
              }
              return handleCancel(params[0], ctx);
            },
            params: [{ name: "sessionId", maxLength: ConfirmationSessionId.MAX_LENGTH }],
          }],
        ])
      : undefined,
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

function createSwapExecuteCommand(deps: SwapCommandDeps): Command {
  const { confirmationRepository, confirmationFormatter, swapRepository } = deps;

  // Check if confirmation flow is available
  const hasConfirmationFlow = confirmationRepository && confirmationFormatter && swapRepository;

  /**
   * Parse session ID from callback parameter
   */
  function parseSessionId(sessionIdStr: string): ConfirmationSessionId | null {
    try {
      return new ConfirmationSessionId(sessionIdStr);
    } catch {
      return null;
    }
  }

  /**
   * Handle confirm callback - check slippage and execute or show re-confirm
   */
  async function handleConfirm(
    sessionIdStr: string,
    ctx: import("./types.js").CommandExecutionContext,
  ): Promise<import("../protocol/types.js").ClientResponse> {
    const sessionId = parseSessionId(sessionIdStr);
    if (!sessionId) {
      return confirmationFormatter!.formatSessionNotFound();
    }

    const session = confirmationRepository!.get(sessionId);

    if (!session) {
      return confirmationFormatter!.formatSessionNotFound();
    }

    // Check if session belongs to this user
    if (!session.telegramId.equals(ctx.telegramId)) {
      logger.warn("SwapExecute", "Session user mismatch", {
        sessionUser: session.telegramId.value,
        requestUser: ctx.telegramId.value,
      });
      return confirmationFormatter!.formatSessionNotFound();
    }

    // Get fresh quote to check slippage
    let freshQuote;
    try {
      freshQuote = await swapRepository!.getQuoteUsdcToAsset(
        session.amount,
        session.asset as AssetSymbol,
      );
    } catch (error) {
      logger.error("SwapExecute", "Failed to get fresh quote", {
        error: error instanceof Error ? error.message : String(error),
      });
      confirmationRepository!.cancel(sessionId);
      return deps.swapFormatter.format({
        status: "quote_error",
        message: "Failed to refresh quote",
      });
    }

    // Check slippage
    if (SlippagePolicy.isExceeded(session.quote, freshQuote)) {
      // Can we re-confirm?
      if (confirmationRepository!.updateQuote(sessionId, freshQuote)) {
        // Show slippage warning with new price
        return confirmationFormatter!.formatSlippageWarning(
          session.type,
          session.quote,
          freshQuote,
          sessionId,
          confirmationRepository!.getTtlSeconds(),
        );
      } else {
        // Max re-confirms exceeded
        confirmationRepository!.cancel(sessionId);
        return confirmationFormatter!.formatMaxSlippageExceeded(session.type);
      }
    }

    // Slippage OK - consume session and execute
    confirmationRepository!.consume(sessionId);

    // Execute swap (synchronously collect result)
    let result: SwapResult = { status: "unavailable" };
    for await (const step of deps.executeSwap.execute(ctx.telegramId, session.amount, session.asset)) {
      if (step.step === "completed") {
        result = step.result;
      }
    }
    return deps.swapFormatter.format(result);
  }

  /**
   * Handle cancel callback
   */
  function handleCancel(
    sessionIdStr: string,
    ctx: import("./types.js").CommandExecutionContext,
  ): import("../protocol/types.js").ClientResponse {
    const sessionId = parseSessionId(sessionIdStr);
    if (!sessionId) {
      return confirmationFormatter!.formatSessionNotFound();
    }

    const session = confirmationRepository!.get(sessionId);

    if (!session) {
      return confirmationFormatter!.formatSessionNotFound();
    }

    // Check if session belongs to this user
    if (!session.telegramId.equals(ctx.telegramId)) {
      logger.warn("SwapExecute", "Cancel session user mismatch", {
        sessionUser: session.telegramId.value,
        requestUser: ctx.telegramId.value,
      });
      return confirmationFormatter!.formatSessionNotFound();
    }

    confirmationRepository!.cancel(sessionId);
    return confirmationFormatter!.formatCancelled(session.type);
  }

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

      // With confirmation flow: show preview
      if (hasConfirmationFlow) {
        try {
          const quote = await swapRepository!.getQuoteUsdcToAsset(
            amount,
            asset.toUpperCase() as AssetSymbol,
          );
          const sessionId = confirmationRepository!.store(
            ctx.telegramId,
            "swap_execute",
            amount,
            asset.toUpperCase(),
            quote,
          );
          return confirmationFormatter!.formatPreview(
            "swap_execute",
            amount,
            asset.toUpperCase(),
            quote,
            sessionId,
            confirmationRepository!.getTtlSeconds(),
          );
        } catch (error) {
          logger.error("SwapExecute", "Failed to get quote for preview", {
            error: error instanceof Error ? error.message : String(error),
          });
          return deps.swapFormatter.format({
            status: "quote_error",
            message: "Failed to get quote",
          });
        }
      }

      // Without confirmation flow: execute directly
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

      // With confirmation flow: show preview (no streaming needed for preview)
      if (hasConfirmationFlow) {
        try {
          const quote = await swapRepository!.getQuoteUsdcToAsset(
            amount,
            asset.toUpperCase() as AssetSymbol,
          );
          const sessionId = confirmationRepository!.store(
            ctx.telegramId,
            "swap_execute",
            amount,
            asset.toUpperCase(),
            quote,
          );
          yield {
            response: confirmationFormatter!.formatPreview(
              "swap_execute",
              amount,
              asset.toUpperCase(),
              quote,
              sessionId,
              confirmationRepository!.getTtlSeconds(),
            ),
            mode: "final",
          };
          return;
        } catch (error) {
          logger.error("SwapExecute", "Failed to get quote for preview", {
            error: error instanceof Error ? error.message : String(error),
          });
          yield {
            response: deps.swapFormatter.format({
              status: "quote_error",
              message: "Failed to get quote",
            }),
            mode: "final",
          };
          return;
        }
      }

      // Without confirmation flow: stream progress from use case
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
    callbacks: hasConfirmationFlow
      ? new Map([
          ["confirm", {
            handler: async (ctx, params) => {
              if (params.length === 0) {
                return confirmationFormatter!.formatSessionNotFound();
              }
              return handleConfirm(params[0], ctx);
            },
            params: [{ name: "sessionId", maxLength: ConfirmationSessionId.MAX_LENGTH }],
          }],
          ["cancel", {
            handler: async (ctx, params) => {
              if (params.length === 0) {
                return confirmationFormatter!.formatSessionNotFound();
              }
              return handleCancel(params[0], ctx);
            },
            params: [{ name: "sessionId", maxLength: ConfirmationSessionId.MAX_LENGTH }],
          }],
        ])
      : undefined,
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
      text += PortfolioFormatter.formatTargetAllocations() + "\n\n";
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
