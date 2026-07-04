import { Command, CommandDefinition } from "../types.js";
import { AssetsCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";
import { StreamUtils } from "../../protocol/gateway/stream.js";
import type { ClientResponseStream } from "../../protocol/types.js";

export class AssetsCommand implements Command {
    public readonly definition: CommandDefinition = Definitions.assets;
    public readonly requiredRole = "admin" as const;

    constructor(private readonly deps: AssetsCommandDeps) { }

    public handler(_args: string[], ctx: import("../types.js").CommandExecutionContext): ClientResponseStream {
        return StreamUtils.finalFrom(async () => {
            const result = await this.deps.discoverAssets.execute(ctx.telegramId);
            return this.deps.formatter.format(result);
        });
    }
}
