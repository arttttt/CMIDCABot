/**
 * Cached Balance Repository
 *
 * In-memory cache over SolanaService RPC calls.
 * Reduces RPC request frequency during sequential read operations.
 *
 * Uses batch RPC requests to fetch all balances in a single HTTP call,
 * reducing RPC billing and rate limit consumption by 4x.
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
 * Token configurations for batch balance fetching
 */
const TOKEN_CONFIGS = {
  btc: { mint: TOKEN_MINTS.BTC, decimals: TOKEN_DECIMALS.BTC },
  eth: { mint: TOKEN_MINTS.ETH, decimals: TOKEN_DECIMALS.ETH },
  usdc: { mint: TOKEN_MINTS.USDC, decimals: TOKEN_DECIMALS.USDC },
} as const;

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
   *
   * Uses batch RPC to fetch all balances in a single HTTP request,
   * reducing RPC calls from 4 to 1.
   */
  async getBalances(walletAddress: string): Promise<WalletBalances> {
    const cached = this.cache.get(walletAddress);

    if (cached && this.isCacheValid(cached)) {
      logger.debug("BalanceCache", "Cache hit", {
        wallet: walletAddress.slice(0, 8),
      });
      return cached.balances;
    }

    logger.debug("BalanceCache", "Cache miss, fetching via batch RPC", {
      wallet: walletAddress.slice(0, 8),
    });

    // Fetch all balances in a single batch RPC request
    const { sol, btc, eth, usdc } = await this.solanaService.getAllBalancesBatch(
      walletAddress,
      TOKEN_CONFIGS,
    );

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
