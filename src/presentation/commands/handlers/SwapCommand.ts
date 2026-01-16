import { Command, CommandDefinition } from "../types.js";
import { SwapCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";
import { ConfirmationSessionId } from "../../../domain/models/id/index.js";
import { logger } from "../../../infrastructure/shared/logging/index.js";
import { SlippagePolicy } from "../../../domain/policies/SlippagePolicy.js";
import type { SwapResult } from "../../../domain/models/SwapStep.js";
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

export class SwapCommand implements Command {
    public readonly definition: CommandDefinition = Definitions.swap;
    public readonly requiredRole = "user" as const;
    public readonly subcommands = new Map<string, Command>();

    constructor(private readonly deps: SwapCommandDeps) {
        this.subcommands.set("quote", this.createQuoteCommand());
        this.subcommands.set("execute", this.createExecuteCommand());
    }

    public async handler(_args: string[], _ctx: import("../types.js").CommandExecutionContext) {
        return this.deps.swapFormatter.formatUnifiedUsage();
    }

    private createQuoteCommand(): Command {
        return {
            definition: { name: "quote", description: "Get quote for swap", usage: "<amount> [asset]" },
            handler: async (args, _ctx) => {
                const amountStr = args[0];
                if (!amountStr) {
                    return this.deps.quoteFormatter.formatUsage();
                }
                const amount = parseAmount(amountStr);
                if (amount === null) {
                    return this.deps.quoteFormatter.formatUsage();
                }
                const asset = args[1] || "SOL";
                const result = await this.deps.getQuote.execute(amount, asset);
                return this.deps.quoteFormatter.format(result);
            },
        };
    }

    private createExecuteCommand(): Command {
        const deps = this.deps;
        const { confirmationRepository, confirmationFormatter, swapRepository } = deps;
        const hasConfirmationFlow = confirmationRepository && confirmationFormatter && swapRepository;

        const cmd: Command = {
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
        };

        if (hasConfirmationFlow) {
            cmd.callbacks = new Map([
                ["confirm", {
                    handler: async (ctx, params) => {
                        if (params.length === 0) {
                            return confirmationFormatter!.formatSessionNotFound();
                        }
                        return this.handleConfirm(params[0], ctx);
                    },
                    params: [{ name: "sessionId", maxLength: ConfirmationSessionId.MAX_LENGTH }],
                }],
                ["cancel", {
                    handler: async (ctx, params) => {
                        if (params.length === 0) {
                            return confirmationFormatter!.formatSessionNotFound();
                        }
                        return this.handleCancel(params[0], ctx);
                    },
                    params: [{ name: "sessionId", maxLength: ConfirmationSessionId.MAX_LENGTH }],
                }],
            ]);
        }

        return cmd;
    }

    private parseSessionId(sessionIdStr: string): ConfirmationSessionId | null {
        try {
            return new ConfirmationSessionId(sessionIdStr);
        } catch {
            return null;
        }
    }

    private async handleConfirm(
        sessionIdStr: string,
        ctx: import("../types.js").CommandExecutionContext,
    ): Promise<import("../../protocol/types.js").ClientResponse> {
        const { confirmationRepository, confirmationFormatter, swapRepository } = this.deps;
        const sessionId = this.parseSessionId(sessionIdStr);
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
            return this.deps.swapFormatter.format({
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
        for await (const step of this.deps.executeSwap.execute(ctx.telegramId, session.amount, session.asset)) {
            if (step.step === "completed") {
                result = step.result;
            }
        }
        return this.deps.swapFormatter.format(result);
    }

    private handleCancel(
        sessionIdStr: string,
        ctx: import("../types.js").CommandExecutionContext,
    ): import("../../protocol/types.js").ClientResponse {
        const { confirmationRepository, confirmationFormatter } = this.deps;
        const sessionId = this.parseSessionId(sessionIdStr);
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
}
