/**
 * SwapQuote - data-only model for swap quote information
 */

import type { TokenMint } from "../id/index.js";

export interface SwapQuote {
  inputMint: TokenMint;
  inputSymbol: string;
  inputAmount: number;
  inputAmountRaw: string;
  outputMint: TokenMint;
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
