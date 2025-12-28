/**
 * Gateway core dispatcher
 *
 * Routes requests to appropriate handlers by kind.
 * No business logic - only dispatch.
 */

import type { GatewayHandler, GatewayRequest, RequestHandler } from "./types.js";
import type { GatewayContext } from "./GatewayContext.js";
import type { ClientResponseStream } from "../types.js";
import { StreamUtils } from "./stream.js";
import { GatewayMessages } from "./messages.js";

export class GatewayCore implements GatewayHandler {
  private readonly handlers: Map<string, RequestHandler<GatewayRequest["kind"]>>;

  constructor(handlers: RequestHandler<GatewayRequest["kind"]>[]) {
    this.handlers = new Map(handlers.map((h) => [h.kind, h]));
  }

  async handle(req: GatewayRequest, ctx: GatewayContext): Promise<ClientResponseStream> {
    const handler = this.handlers.get(req.kind);
    if (!handler) {
      return StreamUtils.final({ text: GatewayMessages.UNKNOWN_REQUEST_TYPE });
    }

    // Type assertion required: TypeScript cannot narrow handler type based on Map key lookup.
    // Safe because: handlers Map is keyed by `kind`, so handler.kind === req.kind is guaranteed.
    const typedReq = req as Parameters<typeof handler.handle>[0];
    return handler.handle(typedReq, ctx);
  }
}
