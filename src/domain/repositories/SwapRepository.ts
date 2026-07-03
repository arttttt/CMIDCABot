/**
 * Swap Repository Interface
 *
 * Port for swap operations (Dependency Inversion).
 * Abstracts Jupiter swap API details from domain layer.
 */

import type { AssetSymbol } from "../constants/portfolio.js";
import type { WalletAddress } from "../models/id/index.js";
import type { SwapQuote } from "../models/quote/SwapQuote.js";

/**
 * Built swap transaction ready for signing
 */
export interface SwapTransaction {
  // Base64 encoded serialized transaction
  transactionBase64: string;
  // Block height after which transaction is invalid
  lastValidBlockHeight: number;
  // Estimated priority fee in lamports
  priorityFeeLamports: number;
}

/**
 * Port for swap operations.
 * Domain layer depends on this interface, not on concrete Jupiter implementation.
 */
export interface SwapRepository {
  /**
   * Get quote for USDC → asset swap by asset symbol
   * Domain-friendly method - handles mint address resolution internally
   */
  getQuoteUsdcToAsset(
    amountUsdc: number,
    asset: AssetSymbol,
    slippageBps?: number,
  ): Promise<SwapQuote>;

  /**
   * Build a swap transaction from a quote
   * Returns a serialized transaction ready for signing
   */
  buildSwapTransaction(
    quote: SwapQuote,
    userPublicKey: WalletAddress,
  ): Promise<SwapTransaction>;
}
