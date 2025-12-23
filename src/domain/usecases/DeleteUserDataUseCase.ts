/**
 * Delete user use case
 *
 * Completely removes a user from the system:
 * - Authorization record
 * - User record (wallet, private key, DCA settings)
 * - Transaction history
 * - Portfolio (dev mode only)
 * - Purchase history (dev mode only)
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { TransactionRepository } from "../repositories/TransactionRepository.js";
import { PortfolioRepository } from "../repositories/PortfolioRepository.js";
import { PurchaseRepository } from "../repositories/PurchaseRepository.js";
import { RemoveAuthorizedUserUseCase, RemoveAuthorizedUserResult } from "./RemoveAuthorizedUserUseCase.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class DeleteUserDataUseCase {
  constructor(
    private removeAuthorizedUser: RemoveAuthorizedUserUseCase,
    private userRepository: UserRepository,
    private transactionRepository: TransactionRepository,
    private portfolioRepository?: PortfolioRepository,
    private purchaseRepository?: PurchaseRepository,
  ) {}

  async execute(adminTelegramId: number, targetTelegramId: number): Promise<RemoveAuthorizedUserResult> {
    // Remove user authorization (includes permission checks)
    const result = await this.removeAuthorizedUser.execute(adminTelegramId, targetTelegramId);
    if (!result.success) {
      return result;
    }

    // Delete all user data
    logger.info("DeleteUserData", "Deleting user data", { telegramId: targetTelegramId });

    await this.userRepository.delete(targetTelegramId);
    await this.transactionRepository.deleteByUserId(targetTelegramId);

    if (this.portfolioRepository) {
      await this.portfolioRepository.deleteByUserId(targetTelegramId);
    }

    if (this.purchaseRepository) {
      await this.purchaseRepository.deleteByUserId(targetTelegramId);
    }

    logger.info("DeleteUserData", "User data deleted", { telegramId: targetTelegramId });

    return result;
  }
}
