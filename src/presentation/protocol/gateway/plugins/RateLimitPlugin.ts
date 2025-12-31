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
import type { UserIdentity } from "../../../../domain/models/UserIdentity.js";
import { ClientResponse } from "../../types.js";
import { StreamUtils } from "../stream.js";
import { logger } from "../../../../infrastructure/shared/logging/index.js";

/**
 * Configuration for RateLimitPlugin
 */
export interface RateLimitConfig {
  /** Window size in milliseconds */
  windowMs: number;
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** Owner telegram ID (whitelisted, bypasses rate limit) */
  ownerTelegramId: number;
}

/**
 * Get rate limit key from user identity
 */
function getRateLimitKey(identity: UserIdentity): string {
  return identity.provider === "telegram"
    ? `tg:${identity.telegramId}`
    : `http:${identity.sessionId}`;
}

class RateLimitHandler implements GatewayHandler {
  constructor(
    private readonly repository: RateLimitRepository,
    private readonly config: RateLimitConfig,
    private readonly next: GatewayHandler,
  ) {}

  async handle(req: GatewayRequest, ctx: GatewayContext): Promise<ClientResponseStream> {
    // Owner whitelist - bypass rate limit
    if (this.isOwner(req.identity)) {
      return this.next.handle(req, ctx);
    }

    const key = getRateLimitKey(req.identity);
    const result = this.repository.checkAndRecord(
      key,
      ctx.nowMs,
      this.config.windowMs,
      this.config.maxRequests,
    );

    if (!result.allowed) {
      logger.warn("Gateway", "Rate limit exceeded", {
        requestId: ctx.requestId,
        key,
        count: result.count,
        limit: this.config.maxRequests,
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
      identity.telegramId === this.config.ownerTelegramId
    );
  }
}

export class RateLimitPlugin implements GatewayPlugin {
  constructor(
    private readonly repository: RateLimitRepository,
    private readonly config: RateLimitConfig,
  ) {}

  apply(next: GatewayHandler): GatewayHandler {
    return new RateLimitHandler(this.repository, this.config, next);
  }
}
