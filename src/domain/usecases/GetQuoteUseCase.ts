/**
 * GetQuoteUseCase - Fetches swap quote from Jupiter
 * Dev-only use case for testing swap integration without executing
 */

import { JupiterSwapService, SwapQuote } from "../../services/jupiter-swap.js";

export type GetQuoteResult =
  | { status: "success"; quote: SwapQuote }
  | { status: "unavailable" }
  | { status: "invalid_amount"; message: string }
  | { status: "error"; message: string };

export class GetQuoteUseCase {
  constructor(private jupiterSwap: JupiterSwapService | undefined) {}

  /**
   * Get quote for SOL → USDC swap
   * @param amountSol Amount of SOL to swap
   */
  async execute(amountSol: number): Promise<GetQuoteResult> {
    if (!this.jupiterSwap) {
      return { status: "unavailable" };
    }

    // Validate amount
    if (isNaN(amountSol) || amountSol <= 0) {
      return {
        status: "invalid_amount",
        message: "Amount must be a positive number",
      };
    }

    // Minimum amount check (to avoid dust transactions)
    if (amountSol < 0.001) {
      return {
        status: "invalid_amount",
        message: "Minimum amount is 0.001 SOL",
      };
    }

    try {
      const quote = await this.jupiterSwap.getQuoteSolToUsdc(amountSol);
      return { status: "success", quote };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { status: "error", message };
    }
  }
}
