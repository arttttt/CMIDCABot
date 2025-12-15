/**
 * Repository factory for creating repositories based on database mode
 */
import { Kysely } from "kysely";
import type { DatabaseMode } from "../../types/config.js";
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

import { InMemoryUserRepository } from "../repositories/memory/InMemoryUserRepository.js";
import { InMemoryTransactionRepository } from "../repositories/memory/InMemoryTransactionRepository.js";
import { InMemoryPortfolioRepository } from "../repositories/memory/InMemoryPortfolioRepository.js";
import { InMemoryPurchaseRepository } from "../repositories/memory/InMemoryPurchaseRepository.js";
import { InMemorySchedulerRepository } from "../repositories/memory/InMemorySchedulerRepository.js";

import { KeyEncryptionService } from "../../services/encryption.js";

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
 * Create main database repositories based on mode
 */
export function createMainRepositories(
  mode: DatabaseMode,
  encryptionService: KeyEncryptionService,
  db?: Kysely<MainDatabase>,
): MainRepositories {
  if (mode === "memory") {
    return {
      userRepository: new InMemoryUserRepository(encryptionService),
      transactionRepository: new InMemoryTransactionRepository(),
    };
  }

  if (!db) {
    throw new Error("SQLite mode requires a database instance");
  }

  return {
    userRepository: new SQLiteUserRepository(db, encryptionService),
    transactionRepository: new SQLiteTransactionRepository(db),
  };
}

/**
 * Create mock database repositories based on mode
 */
export function createMockRepositories(
  mode: DatabaseMode,
  db?: Kysely<MockDatabase>,
): MockRepositories {
  if (mode === "memory") {
    return {
      portfolioRepository: new InMemoryPortfolioRepository(),
      purchaseRepository: new InMemoryPurchaseRepository(),
      schedulerRepository: new InMemorySchedulerRepository(),
    };
  }

  if (!db) {
    throw new Error("SQLite mode requires a database instance");
  }

  return {
    portfolioRepository: new SQLitePortfolioRepository(db),
    purchaseRepository: new SQLitePurchaseRepository(db),
    schedulerRepository: new SQLiteSchedulerRepository(db),
  };
}
