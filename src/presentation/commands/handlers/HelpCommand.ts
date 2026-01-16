import { Command, CommandDefinition } from "../types.js";
import { HelpCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";
import { RoleGuard } from "../../protocol/gateway/RoleGuard.js";
import type { UserRole } from "../../../domain/models/AuthorizedUser.js";

/**
 * Filter commands by user role.
 * Returns only commands the user has access to.
 */
function filterCommandsByRole(
    commands: Map<string, Command>,
    role: UserRole,
): Map<string, Command> {
    const filtered = new Map<string, Command>();
    for (const [name, cmd] of commands) {
        if (RoleGuard.canAccess(role, cmd.requiredRole)) {
            filtered.set(name, cmd);
        }
    }
    return filtered;
}

export class HelpCommand implements Command {
    public readonly definition: CommandDefinition = Definitions.help;
    public readonly requiredRole = "guest" as const;

    constructor(private readonly deps: HelpCommandDeps) { }

    public async handler(_args: string[], ctx: import("../types.js").CommandExecutionContext) {
        const allCommands = this.deps.getRegistry().getCommands();
        const filtered = filterCommandsByRole(allCommands, ctx.role);
        const modeInfo = this.deps.getRegistry().getModeInfo();
        return { text: this.deps.helpFormatter.formatHelp(filtered, modeInfo) };
    }
}
