import { Command, CommandDefinition } from "../types.js";
import { AdminCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";
import { parseRole } from "../../formatters/index.js";

export class AdminCommand implements Command {
    public readonly definition: CommandDefinition = Definitions.admin;
    public readonly requiredRole = "admin" as const;
    public readonly subcommands = new Map<string, Command>();

    constructor(private readonly deps: AdminCommandDeps) {
        this.subcommands.set("add", this.createAddCommand());
        this.subcommands.set("remove", this.createRemoveCommand());
        this.subcommands.set("list", this.createListCommand());
        this.subcommands.set("role", this.createRoleCommand());

        const inviteCmd = this.createInviteCommand();
        if (inviteCmd) {
            this.subcommands.set("invite", inviteCmd);
        }
    }

    public async handler(_args: string[], _ctx: import("../types.js").CommandExecutionContext) {
        return this.deps.formatter.formatHelp(this.subcommands.has("invite"));
    }

    private createAddCommand(): Command {
        return {
            definition: { name: "add", description: "Add authorized user", usage: "<user_id> [role]" },
            handler: async (args, ctx) => {
                const idStr = args[0];
                if (!idStr) {
                    return this.deps.formatter.formatAddUsage();
                }

                const resolveResult = await this.deps.userResolver.resolve(idStr);
                if (!resolveResult.success || !resolveResult.telegramId) {
                    return this.deps.formatter.formatResolveError(idStr, resolveResult.error);
                }
                const targetId = resolveResult.telegramId;

                const roleStr = args[1] || "user";
                const role = parseRole(roleStr);
                if (!role) {
                    return this.deps.formatter.formatInvalidRole(roleStr);
                }

                const result = await this.deps.addAuthorizedUser.execute(ctx.telegramId, targetId, role);
                return this.deps.formatter.formatResult(result);
            },
        };
    }

    private createRemoveCommand(): Command {
        return {
            definition: { name: "remove", description: "Remove authorized user", usage: "<user_id>" },
            handler: async (args, ctx) => {
                const idStr = args[0];
                if (!idStr) {
                    return this.deps.formatter.formatRemoveUsage();
                }

                const resolveResult = await this.deps.userResolver.resolve(idStr);
                if (!resolveResult.success || !resolveResult.telegramId) {
                    return this.deps.formatter.formatResolveError(idStr, resolveResult.error);
                }
                const targetId = resolveResult.telegramId;

                const result = await this.deps.deleteUserData.execute(ctx.telegramId, targetId);
                return this.deps.formatter.formatResult(result);
            },
        };
    }

    private createListCommand(): Command {
        return {
            definition: { name: "list", description: "List all authorized users" },
            handler: async (_args, _ctx) => {
                const result = await this.deps.getAllAuthorizedUsers.execute();
                return this.deps.formatter.formatUserList(result.users);
            },
        };
    }

    private createRoleCommand(): Command {
        return {
            definition: { name: "role", description: "Change user role", usage: "<user_id> <role>" },
            handler: async (args, ctx) => {
                const idStr = args[0];
                const roleStr = args[1];

                if (!idStr || !roleStr) {
                    return this.deps.formatter.formatRoleUsage();
                }

                const resolveResult = await this.deps.userResolver.resolve(idStr);
                if (!resolveResult.success || !resolveResult.telegramId) {
                    return this.deps.formatter.formatResolveError(idStr, resolveResult.error);
                }
                const targetId = resolveResult.telegramId;

                const role = parseRole(roleStr);
                if (!role) {
                    return this.deps.formatter.formatInvalidRole(roleStr);
                }

                const result = await this.deps.updateUserRole.execute(ctx.telegramId, targetId, role);
                return this.deps.formatter.formatResult(result);
            },
        };
    }

    private createInviteCommand(): Command | undefined {
        if (!this.deps.generateInvite || !this.deps.inviteFormatter) {
            return undefined;
        }

        const { generateInvite, inviteFormatter } = this.deps;

        return {
            definition: { name: "invite", description: "Create invite link", usage: "[role]" },
            handler: async (args, ctx) => {
                const roleStr = args[0] || "user";
                const role = parseRole(roleStr);
                if (!role) {
                    return inviteFormatter.formatUsage();
                }

                const result = await generateInvite.execute(ctx.telegramId, role);
                return inviteFormatter.formatGenerateResult(result);
            },
        };
    }
}
