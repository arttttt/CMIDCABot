/**
 * AuthorizationHelper - permission checks for use cases
 *
 * This helper provides authorization checks without containing business logic.
 * All mutations (add/remove/update) are handled by dedicated use cases.
 */

import { TelegramId } from "../models/id/index.js";

/**
 * Authorization helper - permission checks for use cases
 */
export class AuthorizationHelper {
  private ownerTelegramIdBranded: TelegramId;

  constructor(ownerTelegramIdRaw: number) {
    this.ownerTelegramIdBranded = new TelegramId(ownerTelegramIdRaw);
  }

  /**
   * Get owner telegram ID
   */
  getOwnerTelegramId(): TelegramId {
    return this.ownerTelegramIdBranded;
  }
}
