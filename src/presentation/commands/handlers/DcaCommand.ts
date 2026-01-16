import { Command, CommandDefinition } from "../types.js";
import { DcaCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";

export class DcaCommand implements Command {
    public readonly definition: CommandDefinition = Definitions.dca;
    public readonly requiredRole = "user" as const;
    public readonly subcommands = new Map<string, Command>();

    constructor(private readonly deps: DcaCommandDeps) {
        this.subcommands.set("start", this.createStartCommand());
        this.subcommands.set("stop", this.createStopCommand());
    }

    public async handler(_args: string[], ctx: import("../types.js").CommandExecutionContext) {
        const result = await this.deps.getDcaStatus.execute(ctx.telegramId);
        return this.deps.formatter.formatStatus(result);
    }

    private createStartCommand(): Command {
        return {
            definition: { name: "start", description: "Start automatic purchases" },
            handler: async (_args, ctx) => {
                const result = await this.deps.startDca.execute(ctx.telegramId);
                return this.deps.formatter.formatStart(result);
            },
        };
    }

    private createStopCommand(): Command {
        return {
            definition: { name: "stop", description: "Stop automatic purchases" },
            handler: async (_args, ctx) => {
                const result = await this.deps.stopDca.execute(ctx.telegramId);
                return this.deps.formatter.formatStop(result);
            },
        };
    }
}
