/**
 * Gateway - unified entry point for presentation layer
 *
 * Composes plugins into a middleware chain.
 * Creates GatewayContext per request.
 */

import type { GatewayHandler, GatewayPlugin, GatewayRequest } from "./types.js";
import { GatewayContext } from "./GatewayContext.js";
import type { ClientResponseStream } from "../types.js";

export class Gateway {
  private readonly handler: GatewayHandler;

  /**
   * Create gateway with plugin chain
   *
   * Plugins are applied right-to-left (reduceRight):
   * - First plugin in array becomes outermost wrapper
   * - Last plugin wraps the core directly
   *
   * Example: [errorBoundary, rateLimit, loadRole]
   * Execution order: errorBoundary → rateLimit → loadRole → core
   */
  constructor(core: GatewayHandler, plugins: GatewayPlugin[]) {
    this.handler = plugins.reduceRight(
      (next, plugin) => plugin.apply(next),
      core,
    );
  }

  /**
   * Handle request through plugin chain
   *
   * Creates fresh GatewayContext for each request.
   */
  handle(req: GatewayRequest): Promise<ClientResponseStream> {
    const ctx = new GatewayContext(crypto.randomUUID());
    return this.handler.handle(req, ctx);
  }
}
