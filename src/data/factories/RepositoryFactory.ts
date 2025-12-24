/**
 * Repository factory for creating SQLite repositories
 */
import { Kysely } from "kysely";
import type { MainDatabase, MockDatabase } from "../types/database.js";

import { UserRepository } from "../../domain/repositories/UserRepository.js";
import { TransactionRepository } from "../../domain/repositories/TransactionRepository.js";
import { PortfolioRepository } from "../../domain/repositories/PortfolioRepository.js";
import { PurchaseRepository } from "../../domain/repositories/PurchaseRepository.js";
import { SchedulerRepository } from "../../domain/repositories/SchedulerRepository.js";

import { SQLiteUserRepository } from "../repositories/sqlite/SQLiteUserRepository.js";
import { SQLiteTransactionRepository } from "../repositories/sqlite/SQLiteTransactionRepository.js";
import { SQLitePortfolioRepository } from "../repositories/sqlite/SQLitePortfolioRepository.js";
import { SQLitePurchaseRepository } from "../repositories/sqlite/SQLitePurchaseRepository.js";
import { SQLiteSchedulerRepository } from "../repositories/sqlite/SQLiteSchedulerRepository.js";

import { KeyEncryptionService } from "../../infrastructure/internal/crypto/index.js";

export interface MainRepositories {
  userRepository: UserRepository;
  transactionRepository: TransactionRepository;
}

export interface MockRepositories {
  portfolioRepository: PortfolioRepository;
  purchaseRepository: PurchaseRepository;
  schedulerRepository: SchedulerRepository;
}

/**
 * Create main database repositories
 */
export function createMainRepositories(
  db: Kysely<MainDatabase>,
  encryptionService: KeyEncryptionService,
): MainRepositories {
  return {
    userRepository: new SQLiteUserRepository(db, encryptionService),
    transactionRepository: new SQLiteTransactionRepository(db),
  };
}

/**
 * Create mock database repositories
 */
export function createMockRepositories(
  db: Kysely<MockDatabase>,
): MockRepositories {
  return {
    portfolioRepository: new SQLitePortfolioRepository(db),
    purchaseRepository: new SQLitePurchaseRepository(db),
    schedulerRepository: new SQLiteSchedulerRepository(db),
  };
}
