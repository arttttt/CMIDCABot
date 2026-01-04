/**
 * Telegram callback handler
 *
 * Processes inline button callbacks from Telegram.
 * Looks up callback by path, checks role, and executes handler.
 */

import type { RequestHandler, GatewayRequest } from "../types.js";
import type { GatewayContext } from "../GatewayContext.js";
import type { CommandRegistry } from "../../../commands/types.js";
import { ClientResponse, type ClientResponseStream } from "../../types.js";
import { StreamUtils } from "../stream.js";
import { GatewayMessages } from "../messages.js";
import { RoleGuard } from "../RoleGuard.js";
import { findCallbackByPath } from "../../../commands/router.js";
import { CommandExecutionContext } from "../../../commands/CommandExecutionContext.js";

export class TelegramCallbackHandler implements RequestHandler<"telegram-callback"> {
  readonly kind = "telegram-callback";

  constructor(private readonly registry: CommandRegistry) {}

  async handle(
    req: Extract<GatewayRequest, { kind: "telegram-callback" }>,
    ctx: GatewayContext,
  ): Promise<ClientResponseStream> {
    const result = findCallbackByPath(this.registry.getCommands(), req.callbackData);
    if (!result) {
      return StreamUtils.final(new ClientResponse(GatewayMessages.UNKNOWN_ACTION));
    }

    if (!RoleGuard.canAccess(ctx.getRole(), result.requiredRole)) {
      // Mask callback - return same message as unknown
      return StreamUtils.final(new ClientResponse(GatewayMessages.UNKNOWN_ACTION));
    }

    const execCtx = new CommandExecutionContext(ctx.requestId, req.identity, ctx.getRole());
    const response = await result.handler(execCtx, result.param);
    return StreamUtils.final(response);
  }
}
