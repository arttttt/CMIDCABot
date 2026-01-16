import { Command, CommandDefinition } from "../types.js";
import { StartCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";
import { PortfolioFormatter } from "../../formatters/index.js";

export class StartCommand implements Command {
    public readonly definition: CommandDefinition = Definitions.start;
    public readonly requiredRole = "guest" as const;

    constructor(private readonly deps: StartCommandDeps) { }

    public async handler(args: string[], ctx: import("../types.js").CommandExecutionContext) {
        const param = args[0];

        // Check for invite token parameter (inv_<token>)
        if (param?.startsWith("inv_") && this.deps.activateInvite && this.deps.inviteFormatter) {
            const token = param.slice(4); // Remove "inv_" prefix
            const result = await this.deps.activateInvite.execute(token, ctx.telegramId);
            return this.deps.inviteFormatter.formatActivateResult(result);
        }

        // Check if user is authorized (role comes from ctx, loaded by LoadRolePlugin)
        if (ctx.role === "guest") {
            return { text: "You need an invite link to use this bot." };
        }

        // Initialize user (for authorized users)
        await this.deps.initUser.execute(ctx.telegramId);

        let text = "**CMI DCA Bot**\n\n";
        text += "Target allocations:\n";
        text += PortfolioFormatter.formatTargetAllocations() + "\n\n";
        text += "The bot purchases the asset furthest below its target allocation.\n\n";
        text += "Use /help for available commands.";

        return { text };
    }
}
