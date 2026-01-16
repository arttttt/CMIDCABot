/**
 * InMemoryOperationLockRepository - repository implementation for operation locks
 *
 * Wraps OperationLockCache data source and implements OperationLockRepository interface.
 */

import type { OperationLockRepository } from "../../../domain/repositories/OperationLockRepository.js";
import type { OperationLockCache } from "../../sources/memory/OperationLockCache.js";

export class InMemoryOperationLockRepository implements OperationLockRepository {
  constructor(
    private readonly cache: OperationLockCache,
    private readonly ownerId: string,
  ) {}

  async acquire(key: string, ttlMs: number, nowMs: number): Promise<boolean> {
    return this.cache.acquire(key, this.ownerId, ttlMs, nowMs);
  }

  async release(key: string): Promise<void> {
    this.cache.release(key, this.ownerId);
  }
}
