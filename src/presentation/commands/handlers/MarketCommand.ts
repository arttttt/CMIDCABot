import { Command, CommandDefinition } from "../types.js";
import { MarketCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";
import { StreamUtils } from "../../protocol/gateway/stream.js";
import type { ClientResponseStream } from "../../protocol/types.js";

export class MarketCommand implements Command {
    public readonly definition: CommandDefinition = Definitions.market;
    public readonly requiredRole = "user" as const;

    constructor(private readonly deps: MarketCommandDeps) { }

    public handler(_args: string[], _ctx: import("../types.js").CommandExecutionContext): ClientResponseStream {
        return StreamUtils.finalFrom(async () => {
            const result = await this.deps.getMarketStatus.execute(Date.now());
            return this.deps.formatter.formatStatus(result);
        });
    }
}
