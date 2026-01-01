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

import type { TelegramId, WalletAddress } from "../models/id/index.js";
import { SwapRepository, SwapQuote } from "../repositories/SwapRepository.js";
import { BlockchainRepository, SimulationResult } from "../repositories/BlockchainRepository.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { AssetSymbol } from "../../types/portfolio.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

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
  | { status: "insufficient_usdc_balance"; required: number; available: number }
  | { status: "insufficient_sol_balance" }
  | { status: "quote_error"; message: string }
  | { status: "build_error"; message: string }
  | { status: "simulation_error"; message: string };

const SUPPORTED_ASSETS: AssetSymbol[] = ["BTC", "ETH", "SOL"];

export class SimulateSwapUseCase {
  constructor(
    private swapRepository: SwapRepository | undefined,
    private blockchainRepository: BlockchainRepository,
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
    telegramId: TelegramId,
    amountUsdc: number,
    asset: string = "SOL",
  ): Promise<SimulateSwapResult> {
    logger.info("SimulateSwap", "Starting simulation", {
      telegramId,
      amountUsdc,
      asset,
    });

    // Check if swap repository is available
    if (!this.swapRepository) {
      logger.warn("SimulateSwap", "Swap repository unavailable");
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
    let walletAddr: WalletAddress | undefined;

    if (this.devPrivateKey) {
      // In dev mode, derive address from dev private key
      walletAddr = await this.blockchainRepository.getAddressFromPrivateKey(this.devPrivateKey);
    } else {
      const user = await this.userRepository.getById(telegramId);
      walletAddr = user?.walletAddress ?? undefined;
    }

    if (!walletAddr) {
      return { status: "no_wallet" };
    }

    // Check USDC balance before calling Jupiter API
    const usdcBalance = await this.blockchainRepository.getUsdcBalance(walletAddr);
    if (usdcBalance < amountUsdc) {
      logger.warn("SimulateSwap", "Insufficient USDC balance", {
        required: amountUsdc,
        available: usdcBalance,
      });
      return {
        status: "insufficient_usdc_balance",
        required: amountUsdc,
        available: usdcBalance,
      };
    }

    // Step 1: Get quote
    logger.step("SimulateSwap", 1, 3, "Getting quote...");
    let quote: SwapQuote;
    try {
      quote = await this.swapRepository!.getQuoteUsdcToAsset(amountUsdc, assetUpper);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("SimulateSwap", "Quote failed", { error: message });
      return { status: "quote_error", message };
    }

    // Step 2: Build transaction
    logger.step("SimulateSwap", 2, 3, "Building transaction...");
    let transactionBase64: string;
    try {
      const swapTx = await this.swapRepository!.buildSwapTransaction(quote, walletAddr);
      transactionBase64 = swapTx.transactionBase64;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("SimulateSwap", "Build failed", { error: message });
      return { status: "build_error", message };
    }

    // Step 3: Simulate transaction
    logger.step("SimulateSwap", 3, 3, "Running simulation...");
    let simulation: SimulationResult;
    try {
      simulation = await this.blockchainRepository.simulateTransaction(transactionBase64);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("SimulateSwap", "Simulation error", { error: message });
      return { status: "simulation_error", message };
    }

    if (simulation.success) {
      logger.info("SimulateSwap", "Simulation completed successfully", {
        unitsConsumed: simulation.unitsConsumed,
      });
    } else {
      logger.warn("SimulateSwap", "Simulation failed", {
        error: simulation.error,
      });
    }

    return {
      status: "success",
      quote,
      simulation,
    };
  }
}
