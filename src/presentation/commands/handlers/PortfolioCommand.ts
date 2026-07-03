import { Command, CommandDefinition } from "../types.js";
import { PortfolioCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";
import { ConfirmationSessionId } from "../../../domain/models/id/index.js";
import { StreamUtils } from "../../protocol/gateway/stream.js";
import type { ResolveConfirmationResult } from "../../../domain/usecases/index.js";
import type { ClientResponse, ClientResponseStream } from "../../protocol/types.js";

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

    public handler(_args: string[], ctx: import("../types.js").CommandExecutionContext): ClientResponseStream {
        return StreamUtils.finalFrom(async () => {
            const result = await this.deps.getPortfolioStatus.execute(ctx.telegramId);
            return this.deps.portfolioFormatter.formatStatus(result);
        });
    }

    private createStatusCommand(): Command {
        return {
            definition: { name: "status", description: "Show portfolio status" },
            handler: (_args, ctx) => StreamUtils.finalFrom(async () => {
                const result = await this.deps.getPortfolioStatus.execute(ctx.telegramId);
                return this.deps.portfolioFormatter.formatStatus(result);
            }),
        };
    }

    private createBuyCommand(): Command {
        const deps = this.deps;

        const cmd: Command = {
            definition: { name: "buy", description: "Buy asset for USDC amount", usage: "<amount>" },
            handler: (args, ctx) => StreamUtils.finalFrom(async () => {
                const amountStr = args[0];
                if (!amountStr) {
                    return deps.purchaseFormatter.formatUsage();
                }
                const amount = parseAmount(amountStr);
                if (amount === null) {
                    return deps.purchaseFormatter.formatUsage();
                }

                // Show confirmation preview; the purchase itself streams via the confirm callback
                const prepared = await deps.preparePurchaseConfirmation.execute(ctx.telegramId, amount);
                switch (prepared.kind) {
                    case "invalid_amount":
                        return deps.purchaseFormatter.format({
                            status: "invalid_amount",
                            message: prepared.message,
                        });
                    case "no_wallet":
                        return deps.purchaseFormatter.format({ status: "no_wallet" });
                    case "quote_error":
                        return deps.purchaseFormatter.format({
                            status: "quote_error",
                            message: "Failed to get quote",
                        });
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
                handler: (ctx, params) => this.handleConfirm(params, ctx),
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

    private handleConfirm(
        params: string[],
        ctx: import("../types.js").CommandExecutionContext,
    ): ClientResponseStream {
        const deps = this.deps;
        const sessionId = this.parseSessionId(params);
        if (!sessionId) {
            return StreamUtils.final(deps.confirmationFormatter.formatSessionNotFound());
        }

        const formatResolution = this.formatResolution.bind(this);

        return (async function* (): ClientResponseStream {
            for await (const step of deps.confirmPurchase.execute(sessionId, ctx.telegramId)) {
                if (step.step === "resolution") {
                    yield { response: formatResolution(step.outcome), mode: "final" };
                    return;
                }

                const purchaseStep = step.purchaseStep;
                if (purchaseStep.step === "completed") {
                    yield {
                        response: deps.purchaseFormatter.format(purchaseStep.result),
                        mode: "final",
                    };
                } else {
                    const formatted = deps.progressFormatter.formatPurchaseStep(purchaseStep);
                    yield { response: formatted.response, mode: formatted.mode };
                }
            }
        })();
    }

    private formatResolution(
        outcome: Exclude<ResolveConfirmationResult, { kind: "confirmed" }>,
    ): ClientResponse {
        const { confirmationFormatter, purchaseFormatter } = this.deps;

        switch (outcome.kind) {
            case "session_not_found":
                return confirmationFormatter.formatSessionNotFound();
            case "quote_refresh_failed":
                return purchaseFormatter.format({
                    status: "quote_error",
                    message: "Failed to refresh quote",
                });
            case "slippage_warning":
                return confirmationFormatter.formatSlippageWarning(
                    outcome.confirmationType,
                    outcome.originalQuote,
                    outcome.freshQuote,
                    outcome.sessionId,
                    outcome.ttlSeconds,
                );
            case "max_slippage_exceeded":
                return confirmationFormatter.formatMaxSlippageExceeded(outcome.confirmationType);
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
