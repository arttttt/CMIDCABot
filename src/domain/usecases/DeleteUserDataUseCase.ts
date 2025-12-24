/**
 * Delete user use case
 *
 * Completely removes a user from the system:
 * - Authorization record
 * - User record (wallet, private key, DCA settings)
 * - Transaction history
 * - Portfolio
 * - Purchase history
 *
 * All delete operations are executed in a single transaction when using SQLite.
 */

import { Kysely } from "kysely";
import { UserRepository } from "../repositories/UserRepository.js";
import { TransactionRepository } from "../repositories/TransactionRepository.js";
import { PortfolioRepository } from "../repositories/PortfolioRepository.js";
import { PurchaseRepository } from "../repositories/PurchaseRepository.js";
import { RemoveAuthorizedUserUseCase, RemoveAuthorizedUserResult } from "./RemoveAuthorizedUserUseCase.js";
import { logger } from "../../infrastructure/shared/logging/index.js";
import type { MainDatabase } from "../../data/types/database.js";

export class DeleteUserDataUseCase {
  constructor(
    private removeAuthorizedUser: RemoveAuthorizedUserUseCase,
    private userRepository: UserRepository,
    private transactionRepository: TransactionRepository,
    private portfolioRepository: PortfolioRepository,
    private purchaseRepository: PurchaseRepository,
    private db?: Kysely<MainDatabase>,
  ) {}

  async execute(adminTelegramId: number, targetTelegramId: number): Promise<RemoveAuthorizedUserResult> {
    // Remove user authorization (includes permission checks)
    const result = await this.removeAuthorizedUser.execute(adminTelegramId, targetTelegramId);
    if (!result.success) {
      return result;
    }

    // Delete all user data
    logger.info("DeleteUserData", "Deleting user data", { telegramId: targetTelegramId });

    // Use transaction if database is available (SQLite mode)
    if (this.db) {
      await this.db.transaction().execute(async (trx) => {
        // Delete in order: dependent tables first, then main table
        await trx.deleteFrom("purchases").where("telegram_id", "=", targetTelegramId).execute();
        await trx.deleteFrom("portfolio").where("telegram_id", "=", targetTelegramId).execute();
        await trx.deleteFrom("transactions").where("telegram_id", "=", targetTelegramId).execute();
        await trx.deleteFrom("users").where("telegram_id", "=", targetTelegramId).execute();
      });
    } else {
      // InMemory mode: execute sequentially (no transaction needed)
      await this.purchaseRepository.deleteByUserId(targetTelegramId);
      await this.portfolioRepository.deleteByUserId(targetTelegramId);
      await this.transactionRepository.deleteByUserId(targetTelegramId);
      await this.userRepository.delete(targetTelegramId);
    }

    logger.info("DeleteUserData", "User data deleted", { telegramId: targetTelegramId });

    return result;
  }
}
