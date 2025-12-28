/**
 * HTTP request handler
 *
 * Processes HTTP requests.
 * TBD: Implementation after HTTP server investigation.
 */

import type { RequestHandler, GatewayRequest } from "../types.js";
import type { GatewayContext } from "../GatewayContext.js";
import type { ClientResponseStream } from "../../types.js";
import { StreamUtils } from "../stream.js";
import { GatewayMessages } from "../messages.js";

export class HttpRequestHandler implements RequestHandler<"http-request"> {
  readonly kind = "http-request";

  async handle(
    _req: Extract<GatewayRequest, { kind: "http-request" }>,
    _ctx: GatewayContext,
  ): Promise<ClientResponseStream> {
    return StreamUtils.final({ text: GatewayMessages.HTTP_NOT_IMPLEMENTED });
  }
}
