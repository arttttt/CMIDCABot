/**
 * Command execution context
 *
 * Typed context passed to command handlers.
 * Provides requestId, identity, role, and convenience telegramId getter.
 */

import type { TelegramId, RequestId } from "../../domain/models/id/index.js";
import type { UserIdentity } from "../../domain/models/UserIdentity.js";
import type { UserRole } from "../../domain/models/AuthorizedUser.js";

export class CommandExecutionContext {
  constructor(
    readonly requestId: RequestId,
    readonly identity: UserIdentity,
    readonly role: UserRole,
  ) {}

  /**
   * Convenience getter for telegramId from identity.
   */
  get telegramId(): TelegramId {
    return this.identity.telegramId;
  }
}
