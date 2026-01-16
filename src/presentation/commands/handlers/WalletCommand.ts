import { Command, CommandDefinition } from "../types.js";
import { WalletCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";

export class WalletCommand implements Command {
    public readonly definition: CommandDefinition = Definitions.wallet;
    public readonly requiredRole = "user" as const;
    public readonly subcommands = new Map<string, Command>();

    constructor(private readonly deps: WalletCommandDeps) {
        this.subcommands.set("create", this.createCreateCommand());
        this.subcommands.set("import", this.createImportCommand());
        this.subcommands.set("export", this.createExportCommand());
        this.subcommands.set("delete", this.createDeleteCommand());
    }

    public async handler(_args: string[], ctx: import("../types.js").CommandExecutionContext) {
        const result = await this.deps.getWalletInfo.execute(ctx.telegramId);
        return this.deps.formatter.formatGetWalletInfo(result);
    }

    private createCreateCommand(): Command {
        return {
            definition: { name: "create", description: "Create new wallet" },
            handler: async (_args, ctx) => {
                const result = await this.deps.createWallet.execute(ctx.telegramId);
                return this.deps.formatter.formatCreateWallet(result);
            },
        };
    }

    private createImportCommand(): Command {
        return {
            definition: { name: "import", description: "Import wallet via secure web form" },
            handler: async (_args, ctx) => {
                const url = this.deps.importSessionStore.store(ctx.telegramId);
                const ttlMinutes = this.deps.importSessionStore.getTtlMinutes();
                return this.deps.formatter.formatImportLink(url, ttlMinutes);
            },
        };
    }

    private createExportCommand(): Command {
        return {
            definition: { name: "export", description: "Export private key" },
            handler: async (_args, ctx) => {
                const result = await this.deps.exportWalletKey.execute(ctx.telegramId);
                return this.deps.formatter.formatExportKey(result);
            },
        };
    }

    private createDeleteCommand(): Command {
        return {
            definition: { name: "delete", description: "Delete wallet" },
            handler: async (_args, ctx) => {
                const result = await this.deps.deleteWallet.execute(ctx.telegramId);
                return this.deps.formatter.formatDeleteWallet(result);
            },
        };
    }
}
