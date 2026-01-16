import { Command, CommandDefinition } from "../types.js";
import { PricesCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";

export class PricesCommand implements Command {
    public readonly definition: CommandDefinition = Definitions.prices;
    public readonly requiredRole = "user" as const;

    constructor(private readonly deps: PricesCommandDeps) { }

    public async handler(_args: string[], _ctx: import("../types.js").CommandExecutionContext) {
        const result = await this.deps.getPrices.execute();
        return this.deps.formatter.format(result);
    }
}
