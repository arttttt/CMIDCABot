/**
 * Swap Repository Interface
 *
 * Port for swap operations (Dependency Inversion).
 * Abstracts Jupiter swap API details from domain layer.
 */

import type { AssetSymbol } from "../../types/portfolio.js";

/**
 * Quote parameters for swap
 */
export interface SwapQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string; // Amount in smallest units
  slippageBps?: number;
}

/**
 * Swap quote result
 */
export interface SwapQuote {
  inputMint: string;
  inputSymbol: string;
  inputAmount: number;
  inputAmountRaw: string;
  outputMint: string;
  outputSymbol: string;
  outputAmount: number;
  outputAmountRaw: string;
  priceImpactPct: number;
  slippageBps: number;
  minOutputAmount: number;
  route: string[];
  fetchedAt: Date;
  // Raw response needed for building swap transaction (opaque to domain)
  rawQuoteResponse: unknown;
}

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
   * Get a swap quote
   */
  getQuote(params: SwapQuoteParams): Promise<SwapQuote>;

  /**
   * Get quote for USDC → token swap by mint address
   * Low-level method - prefer getQuoteUsdcToAsset for domain use
   */
  getQuoteUsdcToToken(
    amountUsdc: number,
    outputMint: string,
    slippageBps?: number,
  ): Promise<SwapQuote>;

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
   * Get quote for SOL → USDC swap
   * Convenience method for common use case
   */
  getQuoteSolToUsdc(
    amountSol: number,
    slippageBps?: number,
  ): Promise<SwapQuote>;

  /**
   * Build a swap transaction from a quote
   * Returns a serialized transaction ready for signing
   */
  buildSwapTransaction(
    quote: SwapQuote,
    userPublicKey: string,
  ): Promise<SwapTransaction>;
}
