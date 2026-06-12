/**
 * Storage composition - encryption, databases, repositories, caches
 *
 * Part of the composition root (app layer): wires data and
 * infrastructure into a single bundle consumed by use cases.
 */

import { randomUUID } from "crypto";
import type { Kysely } from "kysely";
import type { Config } from "../infrastructure/shared/config/envSchema.js";
import type { MainDatabase } from "../data/types/database.js";
import type { AuthDatabase } from "../data/types/authDatabase.js";
import type {
  UserRepository,
  TransactionRepository,
  AuthRepository,
  InviteTokenRepository,
  PriceHistoryRepository,
  SecretStoreRepository,
  ImportSessionRepository,
  RateLimitRepository,
  OperationLockRepository,
  ConfirmationRepository,
} from "../domain/repositories/index.js";
import { KeyEncryptionService } from "../infrastructure/internal/crypto/index.js";
import { createMainDatabase, createAuthDatabase } from "../data/sources/database/index.js";
import { createMainRepositories } from "../data/factories/RepositoryFactory.js";
import { SQLiteAuthRepository } from "../data/repositories/sqlite/SQLiteAuthRepository.js";
import { SQLiteInviteTokenRepository } from "../data/repositories/sqlite/SQLiteInviteTokenRepository.js";
import { SQLitePriceHistoryRepository } from "../data/repositories/sqlite/SQLitePriceHistoryRepository.js";
import {
  SecretCache,
  ImportSessionCache,
  RateLimitCache,
  ConfirmationCache,
  OperationLockCache,
} from "../data/sources/memory/index.js";
import {
  InMemorySecretRepository,
  InMemoryImportSessionRepository,
  InMemoryRateLimitRepository,
  InMemoryConfirmationRepository,
  InMemoryOperationLockRepository,
} from "../data/repositories/memory/index.js";
import { CleanupScheduler } from "../infrastructure/shared/scheduling/index.js";

export interface Storage {
  encryptionService: KeyEncryptionService;
  mainDb: Kysely<MainDatabase>;
  authDb: Kysely<AuthDatabase>;
  userRepository: UserRepository;
  transactionRepository: TransactionRepository;
  authRepository: AuthRepository;
  inviteTokenRepository: InviteTokenRepository;
  priceHistoryRepository: PriceHistoryRepository;
  secretStore: SecretStoreRepository;
  importSessionStore: ImportSessionRepository;
  rateLimitRepository: RateLimitRepository;
  operationLockRepository: OperationLockRepository;
  confirmationRepository: ConfirmationRepository;
  cleanupScheduler: CleanupScheduler;
}

export async function createStorage(config: Config): Promise<Storage> {
  // Encryption service is required for private key protection
  const encryptionService = new KeyEncryptionService();
  await encryptionService.initialize(config.encryption.masterKey);

  const mainDb = await createMainDatabase(config.database.path);
  const authDb = await createAuthDatabase(config.auth.dbPath);

  const { userRepository, transactionRepository } = createMainRepositories(mainDb, encryptionService);
  const authRepository = new SQLiteAuthRepository(authDb);
  const inviteTokenRepository = new SQLiteInviteTokenRepository(authDb);
  const priceHistoryRepository = new SQLitePriceHistoryRepository(mainDb);

  // One-time secret links
  const secretCache = new SecretCache(encryptionService, {
    publicUrl: config.http.publicUrl,
  });
  const secretStore = new InMemorySecretRepository(secretCache);

  // Secure wallet import sessions
  const importSessionCache = new ImportSessionCache({
    publicUrl: config.http.publicUrl,
  });
  const importSessionStore = new InMemoryImportSessionRepository(importSessionCache);

  const rateLimitCache = new RateLimitCache({
    windowMs: config.rateLimit.windowMs,
    maxRequests: config.rateLimit.maxRequests,
  });
  const rateLimitRepository = new InMemoryRateLimitRepository(rateLimitCache);

  // Locks for balance-changing operations; also reused for signal cooldowns
  const operationLockCache = new OperationLockCache();
  const operationLockRepository = new InMemoryOperationLockRepository(
    operationLockCache,
    randomUUID(),
  );

  // Purchase/swap confirmation flow
  const confirmationCache = new ConfirmationCache();
  const confirmationRepository = new InMemoryConfirmationRepository(confirmationCache);

  const cleanupScheduler = new CleanupScheduler([
    { store: secretCache, intervalMs: 60_000, name: "secretCache" },
    { store: importSessionCache, intervalMs: 60_000, name: "importSessionCache" },
    { store: inviteTokenRepository, intervalMs: 3_600_000, name: "inviteTokenRepository" },
    { store: confirmationCache, intervalMs: 60_000, name: "confirmationCache" },
    { store: priceHistoryRepository, intervalMs: 3_600_000, name: "priceHistoryRepository" },
  ]);
  cleanupScheduler.start();

  return {
    encryptionService,
    mainDb,
    authDb,
    userRepository,
    transactionRepository,
    authRepository,
    inviteTokenRepository,
    priceHistoryRepository,
    secretStore,
    importSessionStore,
    rateLimitRepository,
    operationLockRepository,
    confirmationRepository,
    cleanupScheduler,
  };
}
