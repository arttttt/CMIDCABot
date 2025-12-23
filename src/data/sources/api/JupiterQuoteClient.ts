// Jupiter API base URL
const JUPITER_API_BASE = "https://quote-api.jup.ag/v6";

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

  constructor(baseUrl: string = JUPITER_API_BASE) {
    this.baseUrl = baseUrl;
  }

  async getQuote(params: QuoteParams): Promise<Quote> {
    const { inputMint, outputMint, amount, slippageBps = 50 } = params;

    const url = new URL(`${this.baseUrl}/quote`);
    url.searchParams.set("inputMint", inputMint);
    url.searchParams.set("outputMint", outputMint);
    url.searchParams.set("amount", amount.toString());
    url.searchParams.set("slippageBps", slippageBps.toString());

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`);
    }

    return response.json() as Promise<Quote>;
  }
}
