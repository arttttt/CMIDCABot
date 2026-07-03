import { Command, CommandDefinition } from "../types.js";
import { VersionCommandDeps } from "../dependencies.js";
import { Definitions } from "../definitions.js";
import { StreamUtils } from "../../protocol/gateway/stream.js";
import type { ClientResponseStream } from "../../protocol/types.js";

export class VersionCommand implements Command {
    public readonly definition: CommandDefinition = Definitions.version;
    public readonly requiredRole = "admin" as const;

    constructor(private readonly deps: VersionCommandDeps) { }

    public handler(_args: string[], _ctx: import("../types.js").CommandExecutionContext): ClientResponseStream {
        return StreamUtils.final(this.deps.formatter.formatVersion(this.deps.version));
    }
}
