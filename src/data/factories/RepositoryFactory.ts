/**
 * Repository factory for creating SQLite repositories
 */
import { Kysely } from "kysely";
import type { MainDatabase } from "../types/database.js";

import { UserRepository } from "../../domain/repositories/UserRepository.js";
import { TransactionRepository } from "../../domain/repositories/TransactionRepository.js";

import { SQLiteUserRepository } from "../repositories/sqlite/SQLiteUserRepository.js";
import { SQLiteTransactionRepository } from "../repositories/sqlite/SQLiteTransactionRepository.js";

import { KeyEncryptionService } from "../../infrastructure/internal/crypto/index.js";

export interface MainRepositories {
  userRepository: UserRepository;
  transactionRepository: TransactionRepository;
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
