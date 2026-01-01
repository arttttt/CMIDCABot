/**
 * Cached Balance Repository
 *
 * In-memory cache over SolanaRpcClient RPC calls.
 * Reduces RPC request frequency during sequential read operations.
 *
 * Uses batch RPC requests to fetch all balances in a single HTTP call,
 * reducing RPC billing and rate limit consumption by 4x.
 *
 * Cache is invalidated:
 * - After TTL expires (60 seconds by default)
 * - Manually after successful transactions
 */

import { BalanceRepository, WalletBalances } from "../../../domain/repositories/BalanceRepository.js";
import type { WalletAddress } from "../../../domain/models/id/index.js";
import { SolanaRpcClient } from "../../sources/api/index.js";
import { TOKENS } from "../../../infrastructure/shared/config/index.js";
import { logger } from "../../../infrastructure/shared/logging/index.js";

/**
 * Token configurations for batch balance fetching
 */
const TOKEN_CONFIGS = {
  btc: { mint: TOKENS.BTC.mint, decimals: TOKENS.BTC.decimals },
  eth: { mint: TOKENS.ETH.mint, decimals: TOKENS.ETH.decimals },
  usdc: { mint: TOKENS.USDC.mint, decimals: TOKENS.USDC.decimals },
} as const;

/**
 * Cache entry with balances
 */
interface CacheEntry {
  balances: WalletBalances;
}

/**
 * Default cache TTL: 60 seconds
 * Long enough to avoid repeated RPC calls during UI operations,
 * short enough to reflect balance changes after transactions.
 * Cache is invalidated manually after successful transactions.
 */
const DEFAULT_CACHE_TTL_MS = 60_000;

export class CachedBalanceRepository implements BalanceRepository {
  private cache = new Map<string, CacheEntry>();
  private cacheTtlMs: number;

  constructor(
    private solanaRpcClient: SolanaRpcClient,
    cacheTtlMs: number = DEFAULT_CACHE_TTL_MS,
  ) {
    this.cacheTtlMs = cacheTtlMs;
  }

  /**
   * Get all balances for a wallet address.
   * Returns cached data if valid, otherwise fetches from RPC.
   *
   * Uses batch RPC to fetch all balances in a single HTTP request,
   * reducing RPC calls from 4 to 1. Falls back to individual requests
   * if batch is not supported by the RPC provider.
   */
  async getBalances(walletAddress: WalletAddress): Promise<WalletBalances> {
    const addrStr = walletAddress.value;
    const cached = this.cache.get(addrStr);

    if (cached && this.isCacheValid(cached)) {
      logger.debug("BalanceCache", "Cache hit", {
        wallet: addrStr.slice(0, 8),
      });
      return cached.balances;
    }

    logger.debug("BalanceCache", "Cache miss, fetching balances", {
      wallet: addrStr.slice(0, 8),
    });

    let sol: number;
    let btc: number;
    let eth: number;
    let usdc: number;

    try {
      // Try batch RPC first (4x more efficient)
      const result = await this.solanaRpcClient.getAllBalancesBatch(
        addrStr,
        TOKEN_CONFIGS,
      );
      sol = result.sol;
      btc = result.btc;
      eth = result.eth;
      usdc = result.usdc;
    } catch (error) {
      // Fallback to individual requests if batch not supported
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn("BalanceCache", "Batch RPC failed, falling back to individual requests", {
        error: errorMessage,
      });

      ({ sol, btc, eth, usdc } = await this.fetchBalancesIndividually(addrStr));
    }

    const balances: WalletBalances = {
      sol,
      btc,
      eth,
      usdc,
      fetchedAt: new Date(),
    };

    // Store in cache
    this.cache.set(addrStr, { balances });

    logger.debug("BalanceCache", "Balances cached", {
      wallet: addrStr.slice(0, 8),
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
  async getSolBalance(walletAddress: WalletAddress): Promise<number> {
    const balances = await this.getBalances(walletAddress);
    return balances.sol;
  }

  /**
   * Get USDC balance for a wallet (from cache if valid)
   */
  async getUsdcBalance(walletAddress: WalletAddress): Promise<number> {
    const balances = await this.getBalances(walletAddress);
    return balances.usdc;
  }

  /**
   * Invalidate cache for a specific wallet address.
   * Should be called after successful transaction.
   */
  invalidate(walletAddress: WalletAddress): void {
    const addrStr = walletAddress.value;
    const deleted = this.cache.delete(addrStr);
    if (deleted) {
      logger.debug("BalanceCache", "Cache invalidated", {
        wallet: addrStr.slice(0, 8),
      });
    }
  }

  /**
   * Fetch balances using individual RPC requests.
   * Used as fallback when batch RPC is not supported.
   */
  private async fetchBalancesIndividually(
    walletAddress: string,
  ): Promise<{ sol: number; btc: number; eth: number; usdc: number }> {
    const [sol, btc, eth, usdc] = await Promise.all([
      this.solanaRpcClient.getBalance(walletAddress),
      this.solanaRpcClient.getTokenBalance(walletAddress, TOKEN_CONFIGS.btc.mint.value, TOKEN_CONFIGS.btc.decimals),
      this.solanaRpcClient.getTokenBalance(walletAddress, TOKEN_CONFIGS.eth.mint.value, TOKEN_CONFIGS.eth.decimals),
      this.solanaRpcClient.getTokenBalance(walletAddress, TOKEN_CONFIGS.usdc.mint.value, TOKEN_CONFIGS.usdc.decimals),
    ]);

    return { sol, btc, eth, usdc };
  }

  /**
   * Check if cache entry is still valid (not expired)
   */
  private isCacheValid(entry: CacheEntry): boolean {
    const age = Date.now() - entry.balances.fetchedAt.getTime();
    return age < this.cacheTtlMs;
  }
}
