import { Command, CommandDefinition } from "../types.js";
import { SwapCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";
import { ConfirmationSessionId } from "../../../domain/models/id/index.js";
import { StreamUtils } from "../../protocol/gateway/stream.js";
import type { ClientResponse, ClientResponseStream } from "../../protocol/types.js";

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

    public handler(_args: string[], _ctx: import("../types.js").CommandExecutionContext): ClientResponseStream {
        return StreamUtils.final(this.deps.swapFormatter.formatUnifiedUsage());
    }

    private createQuoteCommand(): Command {
        return {
            definition: { name: "quote", description: "Get quote for swap", usage: "<amount> [asset]" },
            handler: (args, _ctx) => StreamUtils.finalFrom(async () => {
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
            }),
        };
    }

    private createExecuteCommand(): Command {
        const deps = this.deps;

        const cmd: Command = {
            definition: { name: "execute", description: "Execute real swap", usage: "<amount> [asset]" },
            handler: (args, ctx) => StreamUtils.finalFrom(async () => {
                const amountStr = args[0];
                if (!amountStr) {
                    return deps.swapFormatter.formatUsage();
                }
                const amount = parseAmount(amountStr);
                if (amount === null) {
                    return deps.swapFormatter.formatUsage();
                }
                const asset = args[1] || "SOL";

                // Show confirmation preview; the swap itself runs via the confirm callback
                const prepared = await deps.prepareSwapConfirmation.execute(ctx.telegramId, amount, asset);
                switch (prepared.kind) {
                    case "invalid_amount":
                        return deps.swapFormatter.format({ status: "invalid_amount", message: prepared.message });
                    case "invalid_asset":
                        return deps.swapFormatter.format({ status: "invalid_asset", message: prepared.message });
                    case "quote_error":
                        return deps.swapFormatter.format({ status: "quote_error", message: "Failed to get quote" });
                    case "ready":
                        return deps.confirmationFormatter.formatPreview(
                            prepared.preview.confirmationType,
                            prepared.preview.amount,
                            prepared.preview.asset,
                            prepared.preview.quote,
                            prepared.preview.sessionId,
                            prepared.preview.ttlSeconds,
                        );
                }
            }),
        };

        cmd.callbacks = new Map([
            ["confirm", {
                handler: (ctx, params) => StreamUtils.finalFrom(() => this.handleConfirm(params, ctx)),
                params: [{ name: "sessionId", maxLength: ConfirmationSessionId.MAX_LENGTH }],
            }],
            ["cancel", {
                handler: (ctx, params) => StreamUtils.finalFrom(() => this.handleCancel(params, ctx)),
                params: [{ name: "sessionId", maxLength: ConfirmationSessionId.MAX_LENGTH }],
            }],
        ]);

        return cmd;
    }

    private parseSessionId(params: string[]): ConfirmationSessionId | null {
        if (params.length === 0) {
            return null;
        }
        try {
            return new ConfirmationSessionId(params[0]);
        } catch {
            return null;
        }
    }

    private async handleConfirm(
        params: string[],
        ctx: import("../types.js").CommandExecutionContext,
    ): Promise<ClientResponse> {
        const { confirmationFormatter, swapFormatter } = this.deps;

        const sessionId = this.parseSessionId(params);
        if (!sessionId) {
            return confirmationFormatter.formatSessionNotFound();
        }

        const result = await this.deps.confirmSwap.execute(sessionId, ctx.telegramId);
        switch (result.kind) {
            case "session_not_found":
                return confirmationFormatter.formatSessionNotFound();
            case "quote_refresh_failed":
                return swapFormatter.format({ status: "quote_error", message: "Failed to refresh quote" });
            case "slippage_warning":
                return confirmationFormatter.formatSlippageWarning(
                    result.confirmationType,
                    result.originalQuote,
                    result.freshQuote,
                    result.sessionId,
                    result.ttlSeconds,
                );
            case "max_slippage_exceeded":
                return confirmationFormatter.formatMaxSlippageExceeded(result.confirmationType);
            case "executed":
                return swapFormatter.format(result.result);
        }
    }

    private async handleCancel(
        params: string[],
        ctx: import("../types.js").CommandExecutionContext,
    ): Promise<ClientResponse> {
        const { confirmationFormatter } = this.deps;

        const sessionId = this.parseSessionId(params);
        if (!sessionId) {
            return confirmationFormatter.formatSessionNotFound();
        }

        const result = await this.deps.cancelConfirmation.execute(sessionId, ctx.telegramId);
        if (result.kind === "session_not_found") {
            return confirmationFormatter.formatSessionNotFound();
        }
        return confirmationFormatter.formatCancelled(result.confirmationType);
    }
}
