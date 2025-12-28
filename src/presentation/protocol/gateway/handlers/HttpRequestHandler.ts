/**
 * HTTP request handler
 *
 * Processes HTTP requests.
 * TBD: Implementation after HTTP server investigation.
 */

import type { RequestHandler, GatewayRequest } from "../types.js";
import type { GatewayContext } from "../GatewayContext.js";
import type { ClientResponseStream } from "../../types.js";
import { final } from "../stream.js";

export class HttpRequestHandler implements RequestHandler<"http-request"> {
  readonly kind = "http-request";

  async handle(
    _req: Extract<GatewayRequest, { kind: "http-request" }>,
    _ctx: GatewayContext,
  ): Promise<ClientResponseStream> {
    // TBD: Implementation after HTTP server investigation
    return final({ text: "HTTP handler not implemented" });
  }
}
