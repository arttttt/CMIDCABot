/**
 * Jupiter Swap Client - Fetches swap quotes from Jupiter Swap API v1
 * https://dev.jup.ag/docs/swap-api
 *
 * This service handles quote fetching for token swaps.
 * Requires API key from https://portal.jup.ag
 */

import { TokenMint } from "../../../domain/models/id/index.js";
import type { SwapQuote } from "../../../domain/models/quote/SwapQuote.js";
import { TOKEN_MINTS, TOKEN_DECIMALS } from "../../../infrastructure/shared/config/index.js";
import { logger } from "../../../infrastructure/shared/logging/index.js";
import { toRawAmount, toHumanAmountNumber } from "../../../infrastructure/shared/math/index.js";

// Jupiter Swap API v1 endpoint
const JUPITER_SWAP_API = "https://api.jup.ag/swap/v1";

/** Default slippage tolerance in basis points (0.5%) */
const DEFAULT_SLIPPAGE_BPS = 50;

/**
 * Sanitize error messages to prevent leaking sensitive data (LOW-003).
 * Removes URLs, API keys, and other potentially sensitive information.
 */
function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message
    .replace(/https?:\/\/[^\s]+/g, "[URL]")
    .replace(/x-api-key[^\s]*/gi, "[API_KEY]")
    .replace(/[A-Za-z0-9+/]{40,}/g, "[REDACTED]"); // Long base64 strings
}

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: null | {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot?: number;
  timeTaken?: number;
}

export interface JupiterSwapResponse {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
  computeUnitLimit: number;
  prioritizationType: {
    computeBudget: {
      microLamports: number;
      estimatedMicroLamports: number;
    };
  };
  dynamicSlippageReport?: {
    slippageBps: number;
    otherAmount: number;
    simulatedIncurredSlippageBps: number;
    amplificationRatio: string;
  };
}

export interface SwapTransaction {
  // Base64 encoded serialized transaction
  transactionBase64: string;
  // Block height after which transaction is invalid
  lastValidBlockHeight: number;
  // Estimated priority fee in lamports
  priorityFeeLamports: number;
}

export interface QuoteParams {
  inputMint: TokenMint;
  outputMint: TokenMint;
  amount: string; // Amount in smallest units (lamports for SOL)
  slippageBps?: number; // Default: 50 (0.5%)
}

export class JupiterSwapClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl: string = JUPITER_SWAP_API) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Get a swap quote from Jupiter
   */
  async getQuote(params: QuoteParams): Promise<SwapQuote> {
    const slippageBps = params.slippageBps ?? DEFAULT_SLIPPAGE_BPS;

    const url = new URL(`${this.baseUrl}/quote`);
    url.searchParams.set("inputMint", params.inputMint.value);
    url.searchParams.set("outputMint", params.outputMint.value);
    url.searchParams.set("amount", params.amount);
    url.searchParams.set("slippageBps", slippageBps.toString());

    logger.api("Jupiter", "GET", url.toString());
    const startTime = Date.now();

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          "x-api-key": this.apiKey,
        },
      });
    } catch (error) {
      // Sanitize network errors to prevent leaking sensitive data (LOW-003)
      const sanitizedMessage = sanitizeErrorMessage(error);
      logger.error("Jupiter", "Quote fetch failed", { error: sanitizedMessage });
      throw new Error(`Jupiter API error: ${sanitizedMessage}`);
    }

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      // Sanitize error response
      const sanitizedError = errorText
        .replace(/https?:\/\/[^\s]+/g, "[URL]")
        .replace(/[A-Za-z0-9+/]{40,}/g, "[REDACTED]");
      logger.error("Jupiter", "Quote API error", {
        status: response.status,
        statusText: response.statusText,
        error: sanitizedError,
        duration,
      });
      throw new Error(`Jupiter Quote API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as JupiterQuoteResponse;
    logger.api("Jupiter", "GET", "/quote", response.status, duration);

    // Determine symbols from mints
    const inputSymbol = this.getSymbolFromMint(data.inputMint);
    const outputSymbol = this.getSymbolFromMint(data.outputMint);

    // Convert raw amounts to human-readable
    const inputDecimals = this.getDecimalsForMint(data.inputMint);
    const outputDecimals = this.getDecimalsForMint(data.outputMint);

    const inputAmount = toHumanAmountNumber(data.inAmount, inputDecimals);
    const outputAmount = toHumanAmountNumber(data.outAmount, outputDecimals);
    const minOutputAmount = toHumanAmountNumber(data.otherAmountThreshold, outputDecimals);

    // Extract route labels
    const route = data.routePlan.map((step) => step.swapInfo.label);

    const quote = {
      inputMint: new TokenMint(data.inputMint),
      inputSymbol,
      inputAmount,
      inputAmountRaw: data.inAmount,
      outputMint: new TokenMint(data.outputMint),
      outputSymbol,
      outputAmount,
      outputAmountRaw: data.outAmount,
      priceImpactPct: parseFloat(data.priceImpactPct),
      slippageBps: data.slippageBps,
      minOutputAmount,
      route,
      fetchedAt: new Date(),
      rawQuoteResponse: data,
    };

    logger.info("Jupiter", "Quote received", {
      input: `${inputAmount} ${inputSymbol}`,
      output: `${outputAmount} ${outputSymbol}`,
      priceImpact: `${quote.priceImpactPct}%`,
      route: route.join(" → "),
    });

    return quote;
  }

  /**
   * Build a swap transaction from a quote
   * Returns a serialized transaction ready for signing
   */
  async buildSwapTransaction(
    quote: SwapQuote,
    userPublicKey: string,
  ): Promise<SwapTransaction> {
    logger.step("Jupiter", 1, 2, "Building swap transaction...");
    logger.debug("Jupiter", "Build request", {
      userPublicKey,
      inputAmount: quote.inputAmount,
      outputAmount: quote.outputAmount,
    });

    const startTime = Date.now();
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/swap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify({
          quoteResponse: quote.rawQuoteResponse,
          userPublicKey,
          // wrapAndUnwrapSol defaults to true in Jupiter API:
          // - When input is SOL mint: Jupiter wraps native SOL → WSOL automatically
          // - When output is SOL mint: Jupiter unwraps WSOL → native SOL automatically
          // This means we receive/spend native SOL, not WSOL token accounts
          // Use dynamic slippage for better execution
          dynamicSlippage: { maxBps: DEFAULT_SLIPPAGE_BPS },
          // Priority fee settings
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
              maxLamports: 1000000, // Max 0.001 SOL for priority
              priorityLevel: "medium",
            },
          },
        }),
      });
    } catch (error) {
      // Sanitize network errors to prevent leaking sensitive data (LOW-003)
      const sanitizedMessage = sanitizeErrorMessage(error);
      logger.error("Jupiter", "Swap build fetch failed", { error: sanitizedMessage });
      throw new Error(`Jupiter API error: ${sanitizedMessage}`);
    }

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      // Sanitize error response
      const sanitizedError = errorText
        .replace(/https?:\/\/[^\s]+/g, "[URL]")
        .replace(/[A-Za-z0-9+/]{40,}/g, "[REDACTED]");
      logger.error("Jupiter", "Swap build API error", {
        status: response.status,
        statusText: response.statusText,
        error: sanitizedError,
        duration,
      });
      throw new Error(`Jupiter Swap API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as JupiterSwapResponse;

    logger.api("Jupiter", "POST", "/swap", response.status, duration);
    logger.info("Jupiter", "Transaction built", {
      lastValidBlockHeight: data.lastValidBlockHeight,
      priorityFee: `${data.prioritizationFeeLamports} lamports`,
      computeUnitLimit: data.computeUnitLimit,
    });

    return {
      transactionBase64: data.swapTransaction,
      lastValidBlockHeight: data.lastValidBlockHeight,
      priorityFeeLamports: data.prioritizationFeeLamports,
    };
  }

  /**
   * Get quote for SOL → USDC swap
   *
   * Note: We pass TOKEN_MINTS.SOL (WSOL mint) as inputMint, but the user pays
   * with native SOL. Jupiter's wrapAndUnwrapSol=true (default) handles the
   * conversion automatically in the swap transaction.
   */
  async getQuoteSolToUsdc(amountSol: number, slippageBps?: number): Promise<SwapQuote> {
    const amountLamports = toRawAmount(amountSol, TOKEN_DECIMALS.SOL);

    return this.getQuote({
      inputMint: TOKEN_MINTS.SOL,
      outputMint: TOKEN_MINTS.USDC,
      amount: amountLamports,
      slippageBps,
    });
  }

  /**
   * Get quote for USDC → token swap
   */
  async getQuoteUsdcToToken(
    amountUsdc: number,
    outputMint: TokenMint,
    slippageBps?: number,
  ): Promise<SwapQuote> {
    const amountRaw = toRawAmount(amountUsdc, TOKEN_DECIMALS.USDC);

    return this.getQuote({
      inputMint: TOKEN_MINTS.USDC,
      outputMint,
      amount: amountRaw,
      slippageBps,
    });
  }

  private getSymbolFromMint(mint: string): string {
    for (const [symbol, address] of Object.entries(TOKEN_MINTS)) {
      if (address.value === mint) return symbol;
    }
    return mint.slice(0, 8) + "...";
  }

  private getDecimalsForMint(mint: string): number {
    switch (mint) {
      case TOKEN_MINTS.SOL.value:
        return TOKEN_DECIMALS.SOL;
      case TOKEN_MINTS.USDC.value:
        return TOKEN_DECIMALS.USDC;
      case TOKEN_MINTS.BTC.value:
        return TOKEN_DECIMALS.BTC;
      case TOKEN_MINTS.ETH.value:
        return TOKEN_DECIMALS.ETH;
      default:
        return 9; // Default to 9 decimals
    }
  }
}
