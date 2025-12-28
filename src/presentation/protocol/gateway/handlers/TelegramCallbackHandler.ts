/**
 * Telegram callback handler
 *
 * Processes inline button callbacks from Telegram.
 * Looks up callback by path, checks role, and executes handler.
 */

import type { RequestHandler, GatewayRequest } from "../types.js";
import type { GatewayContext } from "../GatewayContext.js";
import type { CommandRegistry } from "../../../commands/types.js";
import type { ClientResponseStream } from "../../types.js";
import { final } from "../stream.js";
import { hasRequiredRole } from "../../../../domain/models/AuthorizedUser.js";
import { findCallbackByPath } from "../../../commands/router.js";

export class TelegramCallbackHandler implements RequestHandler<"telegram-callback"> {
  readonly kind = "telegram-callback";

  constructor(private readonly registry: CommandRegistry) {}

  async handle(
    req: Extract<GatewayRequest, { kind: "telegram-callback" }>,
    ctx: GatewayContext,
  ): Promise<ClientResponseStream> {
    const result = findCallbackByPath(this.registry.getCommands(), req.callbackData);
    if (!result) {
      return final({ text: "Unknown action." });
    }

    const role = ctx.getRole();
    if (result.requiredRole && !hasRequiredRole(role, result.requiredRole)) {
      // Mask callback - return same message as unknown
      return final({ text: "Unknown action." });
    }

    // TODO: After command migration, pass CommandExecutionContext instead of telegramId
    const telegramId = req.identity.telegramId;
    const response = await result.handler(telegramId);
    return final(response);
  }
}
