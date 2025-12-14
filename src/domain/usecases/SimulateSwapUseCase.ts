/**
 * SimulateSwapUseCase - Simulates a swap transaction without executing
 * Dev-only use case for testing swap execution path safely
 *
 * Flow:
 * 1. Get quote from Jupiter
 * 2. Build transaction
 * 3. Simulate transaction via RPC
 * 4. Return simulation result (success/error, compute units, logs)
 */

import { JupiterSwapService, SwapQuote } from "../../services/jupiter-swap.js";
import { SolanaService, SimulationResult } from "../../services/solana.js";
import { TOKEN_MINTS } from "../../services/price.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { AssetSymbol } from "../../types/portfolio.js";

export type SimulateSwapResult =
  | {
      status: "success";
      quote: SwapQuote;
      simulation: SimulationResult;
    }
  | { status: "unavailable" }
  | { status: "no_wallet" }
  | { status: "invalid_amount"; message: string }
  | { status: "invalid_asset"; message: string }
  | { status: "quote_error"; message: string }
  | { status: "build_error"; message: string }
  | { status: "simulation_error"; message: string };

const SUPPORTED_ASSETS: AssetSymbol[] = ["BTC", "ETH", "SOL"];

export class SimulateSwapUseCase {
  constructor(
    private jupiterSwap: JupiterSwapService | undefined,
    private solanaService: SolanaService,
    private userRepository: UserRepository,
    private devPrivateKey?: string,
  ) {}

  /**
   * Simulate USDC → asset swap
   * @param telegramId User's Telegram ID
   * @param amountUsdc Amount of USDC to spend
   * @param asset Target asset (BTC, ETH, SOL). Defaults to SOL.
   */
  async execute(
    telegramId: number,
    amountUsdc: number,
    asset: string = "SOL",
  ): Promise<SimulateSwapResult> {
    // Check if Jupiter is available
    if (!this.jupiterSwap) {
      return { status: "unavailable" };
    }

    // Validate amount
    if (isNaN(amountUsdc) || amountUsdc <= 0) {
      return {
        status: "invalid_amount",
        message: "Amount must be a positive number",
      };
    }

    if (amountUsdc < 0.01) {
      return {
        status: "invalid_amount",
        message: "Minimum amount is 0.01 USDC",
      };
    }

    // Validate asset
    const assetUpper = asset.toUpperCase() as AssetSymbol;
    if (!SUPPORTED_ASSETS.includes(assetUpper)) {
      return {
        status: "invalid_asset",
        message: `Unsupported asset: ${asset}. Supported: ${SUPPORTED_ASSETS.join(", ")}`,
      };
    }

    // Get user's wallet address
    let walletAddress: string | undefined;

    if (this.devPrivateKey) {
      // In dev mode, derive address from dev private key
      walletAddress = await this.solanaService.getAddressFromPrivateKey(this.devPrivateKey);
    } else {
      const user = await this.userRepository.getById(telegramId);
      walletAddress = user?.walletAddress ?? undefined;
    }

    if (!walletAddress) {
      return { status: "no_wallet" };
    }

    const outputMint = TOKEN_MINTS[assetUpper];

    // Step 1: Get quote
    let quote: SwapQuote;
    try {
      quote = await this.jupiterSwap.getQuoteUsdcToToken(amountUsdc, outputMint);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { status: "quote_error", message };
    }

    // Step 2: Build transaction
    let transactionBase64: string;
    try {
      const swapTx = await this.jupiterSwap.buildSwapTransaction(quote, walletAddress);
      transactionBase64 = swapTx.transactionBase64;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { status: "build_error", message };
    }

    // Step 3: Simulate transaction
    let simulation: SimulationResult;
    try {
      simulation = await this.solanaService.simulateTransaction(transactionBase64);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { status: "simulation_error", message };
    }

    return {
      status: "success",
      quote,
      simulation,
    };
  }
}
