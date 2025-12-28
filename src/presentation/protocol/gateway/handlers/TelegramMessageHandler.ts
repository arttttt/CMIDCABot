/**
 * Telegram message handler
 *
 * Processes text messages (commands) from Telegram.
 * Parses command, checks role, and routes to command handler.
 */

import type { RequestHandler, GatewayRequest } from "../types.js";
import type { GatewayContext } from "../GatewayContext.js";
import type { CommandRegistry } from "../../../commands/types.js";
import type { ClientResponseStream } from "../../types.js";
import { final } from "../stream.js";
import { hasRequiredRole } from "../../../../domain/models/AuthorizedUser.js";
import { routeCommandStreaming } from "../../../commands/router.js";

export class TelegramMessageHandler implements RequestHandler<"telegram-message"> {
  readonly kind = "telegram-message";

  constructor(private readonly registry: CommandRegistry) {}

  async handle(
    req: Extract<GatewayRequest, { kind: "telegram-message" }>,
    ctx: GatewayContext,
  ): Promise<ClientResponseStream> {
    const text = req.text.trim();

    if (!text.startsWith("/")) {
      return final({ text: "Unknown command. Use /help to see available commands." });
    }

    const parts = text.split(/\s+/);
    const commandName = parts[0].slice(1).toLowerCase();
    const args = parts.slice(1);

    const cmd = this.registry.getCommand(commandName);
    if (!cmd) {
      return final({ text: `Unknown command: ${parts[0]}\nUse /help to see available commands.` });
    }

    const role = ctx.getRole();
    if (cmd.requiredRole && !hasRequiredRole(role, cmd.requiredRole)) {
      // Mask command - return same message as unknown command
      return final({ text: `Unknown command: ${parts[0]}\nUse /help to see available commands.` });
    }

    // TODO: After command migration, pass CommandExecutionContext instead of telegramId
    const telegramId = req.identity.telegramId;
    return routeCommandStreaming(cmd, args, telegramId);
  }
}
