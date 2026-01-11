/**
 * Gateway types
 *
 * Core interfaces for the Gateway architecture:
 * - GatewayRequest: discriminated union for all request types
 * - GatewayHandler: interface for request processing
 * - GatewayPlugin: interface for middleware plugins
 * - RequestHandler: typed handler for specific request kinds
 */

import type { TelegramIdentity, HttpIdentity } from "../../../domain/models/UserIdentity.js";
import type { ClientResponseStream } from "../types.js";
import type { GatewayContext } from "./GatewayContext.js";

/**
 * Gateway request - discriminated union for all request types
 */
export type GatewayRequest =
  | {
      kind: "telegram-message";
      identity: TelegramIdentity;
      text: string;
      username?: string;
    }
  | {
      kind: "telegram-callback";
      identity: TelegramIdentity;
      callbackData: string;
    }
  | {
      kind: "http-request";
      identity: HttpIdentity;
      // TBD: structure will be refined after HTTP server investigation
      path: string;
      method: string;
      body?: unknown;
    };

/**
 * Gateway handler interface
 *
 * Implemented by:
 * - GatewayCore (final dispatcher)
 * - Plugin handlers (wrappers around next handler)
 */
export interface GatewayHandler {
  handle(req: GatewayRequest, ctx: GatewayContext): Promise<ClientResponseStream>;
}

/**
 * Gateway plugin interface
 *
 * Plugins wrap handlers to add cross-cutting concerns:
 * - Error handling
 * - Rate limiting
 * - Role loading
 * - Logging
 */
export interface GatewayPlugin {
  apply(next: GatewayHandler): GatewayHandler;
}

/**
 * Typed request handler for specific request kinds
 *
 * Each handler processes only its designated request type.
 * GatewayCore dispatches to the appropriate handler by kind.
 */
export interface RequestHandler<K extends GatewayRequest["kind"]> {
  readonly kind: K;
  handle(
    req: Extract<GatewayRequest, { kind: K }>,
    ctx: GatewayContext,
  ): Promise<ClientResponseStream>;
}
