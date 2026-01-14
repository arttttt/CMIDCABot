/**
 * Jupiter Swap Repository Implementation
 *
 * Implements SwapRepository interface using JupiterSwapClient.
 * Provides Dependency Inversion for domain layer.
 */

import { TokenMint, type WalletAddress } from "../../domain/models/id/index.js";
import type { SwapQuote } from "../../domain/models/quote/SwapQuote.js";
import type {
  SwapRepository,
  SwapQuoteParams,
  SwapTransaction,
} from "../../domain/repositories/SwapRepository.js";
import type { JupiterSwapClient } from "../sources/api/JupiterSwapClient.js";
import { TOKEN_MINTS } from "../../infrastructure/shared/config/index.js";
import type { AssetSymbol } from "../../types/portfolio.js";

export class JupiterSwapRepository implements SwapRepository {
  constructor(private client: JupiterSwapClient) {}

  async getQuote(params: SwapQuoteParams): Promise<SwapQuote> {
    return this.client.getQuote(params);
  }

  async getQuoteUsdcToToken(
    amountUsdc: number,
    outputMint: TokenMint,
    slippageBps?: number,
  ): Promise<SwapQuote> {
    return this.client.getQuoteUsdcToToken(amountUsdc, outputMint, slippageBps);
  }

  async getQuoteUsdcToAsset(
    amountUsdc: number,
    asset: AssetSymbol,
    slippageBps?: number,
  ): Promise<SwapQuote> {
    const outputMint = TOKEN_MINTS[asset];
    return this.getQuoteUsdcToToken(amountUsdc, outputMint, slippageBps);
  }

  async getQuoteSolToUsdc(amountSol: number, slippageBps?: number): Promise<SwapQuote> {
    return this.client.getQuoteSolToUsdc(amountSol, slippageBps);
  }

  async buildSwapTransaction(quote: SwapQuote, userPublicKey: WalletAddress): Promise<SwapTransaction> {
    return this.client.buildSwapTransaction(quote, userPublicKey.value);
  }
}
