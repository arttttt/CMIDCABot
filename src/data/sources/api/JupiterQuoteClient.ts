/**
 * Jupiter Quote Client - Fetches quotes from Jupiter Quote API v6
 * https://dev.jup.ag/docs/apis/swap-api
 *
 * Requires API key from https://portal.jup.ag
 */

import { logger } from "../../../infrastructure/shared/logging/index.js";

// Jupiter Quote API v6 endpoint
const JUPITER_API_BASE = "https://quote-api.jup.ag/v6";

/**
 * Sanitize error messages to prevent leaking sensitive data.
 */
function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message
    .replace(/https?:\/\/[^\s]+/g, "[URL]")
    .replace(/x-api-key[^\s]*/gi, "[API_KEY]")
    .replace(/[A-Za-z0-9+/]{40,}/g, "[REDACTED]");
}

export interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
}

export interface Quote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
}

export class JupiterQuoteClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl: string = JUPITER_API_BASE) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getQuote(params: QuoteParams): Promise<Quote> {
    const { inputMint, outputMint, amount, slippageBps = 50 } = params;

    const url = new URL(`${this.baseUrl}/quote`);
    url.searchParams.set("inputMint", inputMint);
    url.searchParams.set("outputMint", outputMint);
    url.searchParams.set("amount", amount.toString());
    url.searchParams.set("slippageBps", slippageBps.toString());

    logger.debug("JupiterQuoteClient", "Fetching quote", {
      inputMint: inputMint.slice(0, 8) + "...",
      outputMint: outputMint.slice(0, 8) + "...",
      amount,
    });

    const startTime = Date.now();
    let response: Response;

    try {
      response = await fetch(url.toString(), {
        headers: {
          "x-api-key": this.apiKey,
        },
      });
    } catch (error) {
      const sanitizedMessage = sanitizeErrorMessage(error);
      logger.error("JupiterQuoteClient", "Quote fetch failed", { error: sanitizedMessage });
      throw new Error(`Jupiter API error: ${sanitizedMessage}`);
    }

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      const sanitizedError = errorText
        .replace(/https?:\/\/[^\s]+/g, "[URL]")
        .replace(/[A-Za-z0-9+/]{40,}/g, "[REDACTED]");
      logger.error("JupiterQuoteClient", "Quote API error", {
        status: response.status,
        statusText: response.statusText,
        error: sanitizedError,
        duration,
      });
      throw new Error(`Jupiter Quote API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Quote;
    logger.api("JupiterQuoteClient", "GET", "/quote", response.status, duration);

    return data;
  }
}
