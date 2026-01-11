/**
 * AuthorizationHelper - permission checks for use cases
 *
 * This helper provides authorization checks without containing business logic.
 * All mutations (add/remove/update) are handled by dedicated use cases.
 */

import { TelegramId } from "../models/id/index.js";
import { AuthRepository } from "../repositories/AuthRepository.js";
import { UserRole } from "../models/AuthorizedUser.js";

/**
 * Authorization helper - permission checks for use cases
 */
export class AuthorizationHelper {
  private ownerTelegramIdBranded: TelegramId;

  constructor(
    private authRepository: AuthRepository,
    ownerTelegramIdRaw: number,
  ) {
    this.ownerTelegramIdBranded = new TelegramId(ownerTelegramIdRaw);
  }

  /**
   * Get user's role
   * @deprecated Use GetUserRoleUseCase instead. This method will be removed in future versions.
   */
  async getRole(id: TelegramId): Promise<UserRole | undefined> {
    if (id.equals(this.ownerTelegramIdBranded)) return "owner";

    const user = await this.authRepository.getById(id);
    return user?.role;
  }

  /**
   * Get owner telegram ID
   */
  getOwnerTelegramId(): TelegramId {
    return this.ownerTelegramIdBranded;
  }
}
