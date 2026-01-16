import { Command, CommandDefinition } from "../types.js";
import { VersionCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";

export class VersionCommand implements Command {
    public readonly definition: CommandDefinition = Definitions.version;
    public readonly requiredRole = "admin" as const;

    constructor(private readonly deps: VersionCommandDeps) { }

    public async handler(_args: string[], _ctx: import("../types.js").CommandExecutionContext) {
        return this.deps.formatter.formatVersion(this.deps.version);
    }
}
