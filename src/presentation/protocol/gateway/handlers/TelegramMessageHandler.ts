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
import { StreamUtils } from "../stream.js";
import { GatewayMessages } from "../messages.js";
import { RoleGuard } from "../RoleGuard.js";
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
      return StreamUtils.final({ text: GatewayMessages.UNKNOWN_COMMAND });
    }

    const parts = text.split(/\s+/);
    const commandName = parts[0].slice(1).toLowerCase();
    const args = parts.slice(1);

    const cmd = this.registry.getCommand(commandName);
    if (!cmd) {
      return StreamUtils.final({ text: GatewayMessages.UNKNOWN_COMMAND });
    }

    if (!RoleGuard.canAccess(ctx, cmd.requiredRole)) {
      // Mask command - return same message as unknown command
      return StreamUtils.final({ text: GatewayMessages.UNKNOWN_COMMAND });
    }

    const telegramId = req.identity.telegramId;
    return routeCommandStreaming(cmd, args, telegramId);
  }
}
