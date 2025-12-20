/**
 * Cached Balance Repository
 *
 * In-memory cache over SolanaService RPC calls.
 * Reduces RPC request frequency during sequential read operations.
 *
 * Cache is invalidated:
 * - After TTL expires (10 seconds by default)
 * - Manually after successful transactions
 */

import { BalanceRepository, WalletBalances } from "../../../domain/repositories/BalanceRepository.js";
import { SolanaService } from "../../../services/solana.js";
import { TOKEN_MINTS } from "../../../services/price.js";
import { TOKEN_DECIMALS } from "../../../services/jupiter-swap.js";
import { logger } from "../../../services/logger.js";

/**
 * Cache entry with balances
 */
interface CacheEntry {
  balances: WalletBalances;
}

/**
 * Default cache TTL: 10 seconds
 * Short enough to keep data fresh, long enough to avoid repeated RPC calls
 * during sequential operations (portfolio view → asset selection → balance check)
 */
const DEFAULT_CACHE_TTL_MS = 10_000;

export class CachedBalanceRepository implements BalanceRepository {
  private cache = new Map<string, CacheEntry>();
  private cacheTtlMs: number;

  constructor(
    private solanaService: SolanaService,
    cacheTtlMs: number = DEFAULT_CACHE_TTL_MS,
  ) {
    this.cacheTtlMs = cacheTtlMs;
  }

  /**
   * Get all balances for a wallet address.
   * Returns cached data if valid, otherwise fetches from RPC.
   */
  async getBalances(walletAddress: string): Promise<WalletBalances> {
    const cached = this.cache.get(walletAddress);

    if (cached && this.isCacheValid(cached)) {
      logger.debug("BalanceCache", "Cache hit", {
        wallet: walletAddress.slice(0, 8),
      });
      return cached.balances;
    }

    logger.debug("BalanceCache", "Cache miss, fetching from RPC", {
      wallet: walletAddress.slice(0, 8),
    });

    // Fetch all balances in parallel
    const [sol, btc, eth, usdc] = await Promise.all([
      this.solanaService.getBalance(walletAddress),
      this.solanaService.getTokenBalance(walletAddress, TOKEN_MINTS.BTC, TOKEN_DECIMALS.BTC),
      this.solanaService.getTokenBalance(walletAddress, TOKEN_MINTS.ETH, TOKEN_DECIMALS.ETH),
      this.solanaService.getUsdcBalance(walletAddress),
    ]);

    const balances: WalletBalances = {
      sol,
      btc,
      eth,
      usdc,
      fetchedAt: new Date(),
    };

    // Store in cache
    this.cache.set(walletAddress, { balances });

    logger.debug("BalanceCache", "Balances cached", {
      wallet: walletAddress.slice(0, 8),
      sol,
      btc,
      eth,
      usdc,
    });

    return balances;
  }

  /**
   * Get SOL balance for a wallet (from cache if valid)
   */
  async getSolBalance(walletAddress: string): Promise<number> {
    const balances = await this.getBalances(walletAddress);
    return balances.sol;
  }

  /**
   * Get USDC balance for a wallet (from cache if valid)
   */
  async getUsdcBalance(walletAddress: string): Promise<number> {
    const balances = await this.getBalances(walletAddress);
    return balances.usdc;
  }

  /**
   * Invalidate cache for a specific wallet address.
   * Should be called after successful transaction.
   */
  invalidate(walletAddress: string): void {
    const deleted = this.cache.delete(walletAddress);
    if (deleted) {
      logger.debug("BalanceCache", "Cache invalidated", {
        wallet: walletAddress.slice(0, 8),
      });
    }
  }

  /**
   * Check if cache entry is still valid (not expired)
   */
  private isCacheValid(entry: CacheEntry): boolean {
    const age = Date.now() - entry.balances.fetchedAt.getTime();
    return age < this.cacheTtlMs;
  }
}
