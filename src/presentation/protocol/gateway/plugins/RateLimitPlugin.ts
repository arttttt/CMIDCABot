/**
 * RateLimitPlugin - rate limiting for gateway requests
 *
 * Protects against spam and abuse by limiting request frequency.
 * Uses sliding window algorithm via RateLimitRepository.
 *
 * Features:
 * - Configurable window and max requests via env
 * - Owner whitelist (bypasses rate limit)
 * - Logs warnings on limit exceeded
 */

import type { GatewayPlugin, GatewayHandler, GatewayRequest } from "../types.js";
import type { GatewayContext } from "../GatewayContext.js";
import type { ClientResponseStream } from "../../types.js";
import type { RateLimitRepository } from "../../../../domain/repositories/RateLimitRepository.js";
import type { OwnerConfig } from "../../../../infrastructure/shared/config/index.js";
import type { UserIdentity } from "../../../../domain/models/UserIdentity.js";
import { ClientResponse } from "../../types.js";
import { StreamUtils } from "../stream.js";
import { logger } from "../../../../infrastructure/shared/logging/index.js";

/**
 * Get rate limit key from user identity
 * @throws Error if HTTP identity has empty sessionId
 */
function getRateLimitKey(identity: UserIdentity): string {
  if (identity.provider === "telegram") {
    return `tg:${identity.telegramId.value}`;
  }
  if (!identity.sessionId) {
    throw new Error("HTTP identity must have non-empty sessionId for rate limiting");
  }
  return `http:${identity.sessionId.value}`;
}

class RateLimitHandler implements GatewayHandler {
  constructor(
    private readonly repository: RateLimitRepository,
    private readonly ownerConfig: OwnerConfig,
    private readonly next: GatewayHandler,
  ) {}

  async handle(req: GatewayRequest, ctx: GatewayContext): Promise<ClientResponseStream> {
    // Owner whitelist - bypass rate limit
    if (this.isOwner(req.identity)) {
      return this.next.handle(req, ctx);
    }

    const key = getRateLimitKey(req.identity);
    const result = await this.repository.checkAndRecord(key, ctx.nowMs);

    if (!result.allowed) {
      logger.warn("Gateway", "Rate limit exceeded", {
        requestId: ctx.requestId,
        key,
        count: result.count,
      });

      return StreamUtils.final(
        new ClientResponse("Too many requests. Please wait a moment and try again."),
      );
    }

    return this.next.handle(req, ctx);
  }

  private isOwner(identity: UserIdentity): boolean {
    return (
      identity.provider === "telegram" &&
      identity.telegramId.equals(this.ownerConfig.telegramId)
    );
  }
}

export class RateLimitPlugin implements GatewayPlugin {
  constructor(
    private readonly repository: RateLimitRepository,
    private readonly ownerConfig: OwnerConfig,
  ) {}

  apply(next: GatewayHandler): GatewayHandler {
    return new RateLimitHandler(this.repository, this.ownerConfig, next);
  }
}
