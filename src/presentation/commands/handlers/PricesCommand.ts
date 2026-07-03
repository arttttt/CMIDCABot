import { Command, CommandDefinition } from "../types.js";
import { PricesCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";
import { StreamUtils } from "../../protocol/gateway/stream.js";
import type { ClientResponseStream } from "../../protocol/types.js";

export class PricesCommand implements Command {
    public readonly definition: CommandDefinition = Definitions.prices;
    public readonly requiredRole = "user" as const;

    constructor(private readonly deps: PricesCommandDeps) { }

    public handler(_args: string[], _ctx: import("../types.js").CommandExecutionContext): ClientResponseStream {
        return StreamUtils.finalFrom(async () => {
            const result = await this.deps.getPrices.execute();
            return this.deps.formatter.format(result);
        });
    }
}
