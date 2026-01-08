/**
 * Delete user use case
 *
 * Completely removes a user from the system:
 * - Authorization record
 * - User record (wallet, private key, DCA settings)
 * - Transaction history
 */

import type { TelegramId } from "../models/id/index.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { TransactionRepository } from "../repositories/TransactionRepository.js";
import { RemoveAuthorizedUserUseCase, RemoveAuthorizedUserResult } from "./RemoveAuthorizedUserUseCase.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class DeleteUserDataUseCase {
  constructor(
    private removeAuthorizedUser: RemoveAuthorizedUserUseCase,
    private userRepository: UserRepository,
    private transactionRepository: TransactionRepository,
  ) {}

  async execute(adminTelegramId: TelegramId, targetTelegramId: TelegramId): Promise<RemoveAuthorizedUserResult> {
    // Remove user authorization (includes permission checks)
    const result = await this.removeAuthorizedUser.execute(adminTelegramId, targetTelegramId);
    if (!result.success) {
      return result;
    }

    // Delete all user data
    logger.info("DeleteUserData", "Deleting user data", { telegramId: targetTelegramId });

    await this.userRepository.delete(targetTelegramId);
    await this.transactionRepository.deleteByUserId(targetTelegramId);

    logger.info("DeleteUserData", "User data deleted", { telegramId: targetTelegramId });

    return result;
  }
}
