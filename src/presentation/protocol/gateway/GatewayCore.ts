/**
 * Gateway core dispatcher
 *
 * Routes requests to appropriate handlers by kind.
 * No business logic - only dispatch.
 */

import type { GatewayHandler, GatewayRequest, RequestHandler } from "./types.js";
import type { GatewayContext } from "./GatewayContext.js";
import type { ClientResponseStream } from "../types.js";
import { final } from "./stream.js";

export class GatewayCore implements GatewayHandler {
  private readonly handlers: Map<string, RequestHandler<GatewayRequest["kind"]>>;

  constructor(handlers: RequestHandler<GatewayRequest["kind"]>[]) {
    this.handlers = new Map(handlers.map((h) => [h.kind, h]));
  }

  async handle(req: GatewayRequest, ctx: GatewayContext): Promise<ClientResponseStream> {
    const handler = this.handlers.get(req.kind);
    if (!handler) {
      return final({ text: "Unknown request type" });
    }
    // Type assertion needed due to discriminated union dispatch
    return handler.handle(req as never, ctx);
  }
}
