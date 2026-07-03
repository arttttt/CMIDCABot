import { Command, CommandDefinition } from "../types.js";
import { PortfolioCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";
import { ConfirmationSessionId } from "../../../domain/models/id/index.js";
import { StreamUtils } from "../../protocol/gateway/stream.js";
import { logger } from "../../../infrastructure/shared/logging/index.js";
import { SlippagePolicy } from "../../../domain/policies/SlippagePolicy.js";
import type { StreamItem } from "../../protocol/types.js";
import type { AssetSymbol } from "../../../types/portfolio.js";

// Helper function from original handlers.ts
function parseAmount(amountStr: string): number | null {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        return null;
    }
    return amount;
}

export class PortfolioCommand implements Command {
    public readonly definition: CommandDefinition = Definitions.portfolio;
    public readonly requiredRole = "user" as const;
    public readonly subcommands = new Map<string, Command>();

    constructor(private readonly deps: PortfolioCommandDeps) {
        this.subcommands.set("status", this.createStatusCommand());
        this.subcommands.set("buy", this.createBuyCommand());
    }

    public async handler(_args: string[], ctx: import("../types.js").CommandExecutionContext) {
        const result = await this.deps.getPortfolioStatus.execute(ctx.telegramId);
        return this.deps.portfolioFormatter.formatStatus(result);
    }

    private createStatusCommand(): Command {
        return {
            definition: { name: "status", description: "Show portfolio status" },
            handler: async (_args, ctx) => {
                const result = await this.deps.getPortfolioStatus.execute(ctx.telegramId);
                return this.deps.portfolioFormatter.formatStatus(result);
            },
        };
    }

    private createBuyCommand(): Command {
        const deps = this.deps;
        const { confirmationRepository, confirmationFormatter, swapRepository, determineAssetToBuy } = deps;

        const cmd: Command = {
            definition: { name: "buy", description: "Buy asset for USDC amount", usage: "<amount>" },
            streamingHandler: async function* (args, ctx): AsyncGenerator<StreamItem> {
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

                // Show confirmation preview; the purchase itself streams via the confirm callback
                try {
                    // Determine which asset to buy based on portfolio allocation
                    const assetInfo = await determineAssetToBuy.execute(ctx.telegramId);
                    if (!assetInfo) {
                        yield {
                            response: deps.purchaseFormatter.format({ type: "no_wallet" }),
                            mode: "final",
                        };
                        return;
                    }
                    const asset = assetInfo.symbol;

                    const quote = await swapRepository.getQuoteUsdcToAsset(amount, asset);
                    const sessionId = confirmationRepository.store(
                        ctx.telegramId,
                        "portfolio_buy",
                        amount,
                        asset,
                        quote,
                    );
                    yield {
                        response: confirmationFormatter.formatPreview(
                            "portfolio_buy",
                            amount,
                            asset,
                            quote,
                            sessionId,
                            confirmationRepository.getTtlSeconds(),
                        ),
                        mode: "final",
                    };
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
                }
            },
        };

        cmd.callbacks = new Map([
            ["confirm", {
                streamingHandler: (ctx, params) => {
                    if (params.length === 0) {
                        return StreamUtils.final(confirmationFormatter.formatSessionNotFound());
                    }
                    return this.handleConfirmStream(params[0], ctx);
                },
                params: [{ name: "sessionId", maxLength: ConfirmationSessionId.MAX_LENGTH }],
            }],
            ["cancel", {
                handler: async (ctx, params) => {
                    if (params.length === 0) {
                        return confirmationFormatter.formatSessionNotFound();
                    }
                    return this.handleCancel(params[0], ctx);
                },
                params: [{ name: "sessionId", maxLength: ConfirmationSessionId.MAX_LENGTH }],
            }],
        ]);

        return cmd;
    }

    private parseSessionId(sessionIdStr: string): ConfirmationSessionId | null {
        try {
            return new ConfirmationSessionId(sessionIdStr);
        } catch {
            return null;
        }
    }

    private handleConfirmStream(
        sessionIdStr: string,
        ctx: import("../types.js").CommandExecutionContext,
    ): import("../../protocol/types.js").ClientResponseStream {
        const { confirmationRepository, confirmationFormatter, swapRepository } = this.deps;

        return StreamUtils.catchAsync(async () => {
            const self = this;
            async function* stream(): import("../../protocol/types.js").ClientResponseStream {
                const sessionId = self.parseSessionId(sessionIdStr);
                if (!sessionId) {
                    yield { response: confirmationFormatter.formatSessionNotFound(), mode: "final" };
                    return;
                }

                const session = confirmationRepository.get(sessionId);
                if (!session) {
                    yield { response: confirmationFormatter.formatSessionNotFound(), mode: "final" };
                    return;
                }

                // Check if session belongs to this user
                if (!session.telegramId.equals(ctx.telegramId)) {
                    logger.warn("PortfolioBuy", "Session user mismatch", {
                        sessionUser: session.telegramId.value,
                        requestUser: ctx.telegramId.value,
                    });
                    yield { response: confirmationFormatter.formatSessionNotFound(), mode: "final" };
                    return;
                }

                // Get fresh quote to check slippage
                let freshQuote;
                try {
                    freshQuote = await swapRepository.getQuoteUsdcToAsset(
                        session.amount,
                        session.asset as AssetSymbol,
                    );
                } catch (error) {
                    logger.error("PortfolioBuy", "Failed to get fresh quote", {
                        error: error instanceof Error ? error.message : String(error),
                    });
                    confirmationRepository.cancel(sessionId);
                    yield {
                        response: self.deps.purchaseFormatter.format({
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
                    if (confirmationRepository.updateQuote(sessionId, freshQuote)) {
                        // Show slippage warning with new price
                        yield {
                            response: confirmationFormatter.formatSlippageWarning(
                                session.type,
                                session.quote,
                                freshQuote,
                                sessionId,
                                confirmationRepository.getTtlSeconds(),
                            ),
                            mode: "final",
                        };
                        return;
                    } else {
                        // Max re-confirms exceeded
                        confirmationRepository.cancel(sessionId);
                        yield {
                            response: confirmationFormatter.formatMaxSlippageExceeded(session.type),
                            mode: "final",
                        };
                        return;
                    }
                }

                // Slippage OK - consume session and execute
                confirmationRepository.consume(sessionId);

                // Execute purchase with progress streaming
                for await (const step of self.deps.executePurchase!.execute(ctx.telegramId, session.amount)) {
                    if (step.step === "completed") {
                        yield {
                            response: self.deps.purchaseFormatter.format(step.result),
                            mode: "final",
                        };
                    } else {
                        const formatted = self.deps.progressFormatter.formatPurchaseStep(step);
                        yield { response: formatted.response, mode: formatted.mode };
                    }
                }
            }

            return stream();
        }, (error) => {
            logger.error("PortfolioBuy", "Confirm callback failed", {
                error: error instanceof Error ? error.message : String(error),
            });
            const sessionId = this.parseSessionId(sessionIdStr);
            if (sessionId) {
                confirmationRepository.cancel(sessionId);
            }
            return this.deps.purchaseFormatter.format({
                type: "quote_error",
                error: "Failed to execute purchase",
            });
        });
    }

    private handleCancel(
        sessionIdStr: string,
        ctx: import("../types.js").CommandExecutionContext,
    ): import("../../protocol/types.js").ClientResponse {
        const { confirmationRepository, confirmationFormatter } = this.deps;
        const sessionId = this.parseSessionId(sessionIdStr);
        if (!sessionId) {
            return confirmationFormatter.formatSessionNotFound();
        }

        const session = confirmationRepository.get(sessionId);

        if (!session) {
            return confirmationFormatter.formatSessionNotFound();
        }

        // Check if session belongs to this user
        if (!session.telegramId.equals(ctx.telegramId)) {
            logger.warn("PortfolioBuy", "Cancel session user mismatch", {
                sessionUser: session.telegramId.value,
                requestUser: ctx.telegramId.value,
            });
            return confirmationFormatter.formatSessionNotFound();
        }

        confirmationRepository.cancel(sessionId);
        return confirmationFormatter.formatCancelled(session.type);
    }
}
