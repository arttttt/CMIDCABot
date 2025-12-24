/**
 * Repository factory for creating repositories based on database mode
 */
import { Kysely } from "kysely";
import type { DatabaseMode } from "../../infrastructure/shared/config/index.js";
import type { MainDatabase } from "../types/database.js";

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

import { InMemoryUserRepository } from "../repositories/memory/InMemoryUserRepository.js";
import { InMemoryTransactionRepository } from "../repositories/memory/InMemoryTransactionRepository.js";
import { InMemoryPortfolioRepository } from "../repositories/memory/InMemoryPortfolioRepository.js";
import { InMemoryPurchaseRepository } from "../repositories/memory/InMemoryPurchaseRepository.js";
import { InMemorySchedulerRepository } from "../repositories/memory/InMemorySchedulerRepository.js";

import { KeyEncryptionService } from "../../infrastructure/internal/crypto/index.js";

export interface Repositories {
  userRepository: UserRepository;
  transactionRepository: TransactionRepository;
  portfolioRepository: PortfolioRepository;
  purchaseRepository: PurchaseRepository;
  schedulerRepository: SchedulerRepository;
}

/**
 * Create all repositories based on database mode
 */
export function createRepositories(
  mode: DatabaseMode,
  encryptionService: KeyEncryptionService,
  db?: Kysely<MainDatabase>,
): Repositories {
  if (mode === "memory") {
    return {
      userRepository: new InMemoryUserRepository(encryptionService),
      transactionRepository: new InMemoryTransactionRepository(),
      portfolioRepository: new InMemoryPortfolioRepository(),
      purchaseRepository: new InMemoryPurchaseRepository(),
      schedulerRepository: new InMemorySchedulerRepository(),
    };
  }

  if (!db) {
    throw new Error("SQLite mode requires a database instance");
  }

  return {
    userRepository: new SQLiteUserRepository(db, encryptionService),
    transactionRepository: new SQLiteTransactionRepository(db),
    portfolioRepository: new SQLitePortfolioRepository(db),
    purchaseRepository: new SQLitePurchaseRepository(db),
    schedulerRepository: new SQLiteSchedulerRepository(db),
  };
}
