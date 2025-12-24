/**
 * Jupiter Swap Repository Implementation
 *
 * Implements SwapRepository interface using JupiterSwapClient.
 * Provides Dependency Inversion for domain layer.
 */

import type {
  SwapRepository,
  SwapQuoteParams,
  SwapQuote,
  SwapTransaction,
} from "../../domain/repositories/SwapRepository.js";
import type { JupiterSwapClient, SwapQuote as ClientSwapQuote } from "../sources/api/JupiterSwapClient.js";
import { TOKEN_MINTS } from "../../infrastructure/shared/config/index.js";
import type { AssetSymbol } from "../../types/portfolio.js";

export class JupiterSwapRepository implements SwapRepository {
  constructor(private client: JupiterSwapClient) {}

  async getQuote(params: SwapQuoteParams): Promise<SwapQuote> {
    const quote = await this.client.getQuote(params);
    return this.mapQuote(quote);
  }

  async getQuoteUsdcToToken(
    amountUsdc: number,
    outputMint: string,
    slippageBps?: number,
  ): Promise<SwapQuote> {
    const quote = await this.client.getQuoteUsdcToToken(amountUsdc, outputMint, slippageBps);
    return this.mapQuote(quote);
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
    const quote = await this.client.getQuoteSolToUsdc(amountSol, slippageBps);
    return this.mapQuote(quote);
  }

  async buildSwapTransaction(quote: SwapQuote, userPublicKey: string): Promise<SwapTransaction> {
    // Cast back to client quote type (rawQuoteResponse contains the original data)
    const clientQuote = {
      ...quote,
      rawQuoteResponse: quote.rawQuoteResponse,
    } as ClientSwapQuote;

    return this.client.buildSwapTransaction(clientQuote, userPublicKey);
  }

  /**
   * Map client SwapQuote to domain SwapQuote
   * The types are compatible, but we keep rawQuoteResponse as unknown in domain
   */
  private mapQuote(quote: ClientSwapQuote): SwapQuote {
    return {
      inputMint: quote.inputMint,
      inputSymbol: quote.inputSymbol,
      inputAmount: quote.inputAmount,
      inputAmountRaw: quote.inputAmountRaw,
      outputMint: quote.outputMint,
      outputSymbol: quote.outputSymbol,
      outputAmount: quote.outputAmount,
      outputAmountRaw: quote.outputAmountRaw,
      priceImpactPct: quote.priceImpactPct,
      slippageBps: quote.slippageBps,
      minOutputAmount: quote.minOutputAmount,
      route: quote.route,
      fetchedAt: quote.fetchedAt,
      rawQuoteResponse: quote.rawQuoteResponse,
    };
  }
}
