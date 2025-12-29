/**
 * ErrorBoundaryPlugin - catches and handles errors in gateway pipeline
 *
 * Wraps the entire handler chain with error handling.
 * Logs errors with requestId for tracing.
 * Returns user-friendly error message.
 */

import type { GatewayPlugin, GatewayHandler, GatewayRequest } from "../types.js";
import type { GatewayContext } from "../GatewayContext.js";
import type { ClientResponseStream } from "../../types.js";
import { ClientResponse } from "../../types.js";
import { StreamUtils } from "../stream.js";
import { logger } from "../../../../infrastructure/shared/logging/index.js";

class ErrorBoundaryHandler implements GatewayHandler {
  constructor(private readonly next: GatewayHandler) {}

  handle(req: GatewayRequest, ctx: GatewayContext): Promise<ClientResponseStream> {
    return Promise.resolve(
      StreamUtils.catchAsync(
        () => this.next.handle(req, ctx),
        (error) => this.handleError(error, ctx),
      ),
    );
  }

  private handleError(error: unknown, ctx: GatewayContext): ClientResponse {
    const message = error instanceof Error ? error.message : String(error);

    logger.error("Gateway", "Unhandled error", {
      requestId: ctx.requestId,
      error: message,
    });

    return new ClientResponse("An error occurred. Please try again later.");
  }
}

export class ErrorBoundaryPlugin implements GatewayPlugin {
  apply(next: GatewayHandler): GatewayHandler {
    return new ErrorBoundaryHandler(next);
  }
}
