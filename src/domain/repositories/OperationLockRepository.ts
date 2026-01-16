/**
 * OperationLockRepository - interface for per-user operation locks
 *
 * Prevents parallel execution of balance-changing operations.
 */

export interface OperationLockRepository {
  /**
   * Try to acquire a lock for a key.
   *
   * @param key - Lock key (e.g., "tg:123:balance_mutation")
   * @param ttlMs - Lock TTL in milliseconds
   * @param nowMs - Current timestamp in milliseconds
   * @returns True if lock acquired, false if already locked
   */
  acquire(key: string, ttlMs: number, nowMs: number): Promise<boolean>;

  /**
   * Release a lock for a key.
   *
   * Implementations should ensure only the lock owner can release.
   *
   * @param key - Lock key
   */
  release(key: string): Promise<void>;
}
