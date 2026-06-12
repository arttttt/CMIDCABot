import { Command, CommandDefinition } from "../types.js";
import { MarketCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";

export class MarketCommand implements Command {
    public readonly definition: CommandDefinition = Definitions.market;
    public readonly requiredRole = "user" as const;

    constructor(private readonly deps: MarketCommandDeps) { }

    public async handler(_args: string[], _ctx: import("../types.js").CommandExecutionContext) {
        const result = await this.deps.getMarketStatus.execute(Date.now());
        return this.deps.formatter.formatStatus(result);
    }
}
