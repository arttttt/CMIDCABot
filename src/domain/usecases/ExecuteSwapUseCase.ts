/**
 * ExecuteSwapUseCase - Executes a real swap transaction
 * Dev-only use case for executing real swaps on mainnet
 *
 * Flow:
 * 1. Get quote from Jupiter
 * 2. Build transaction
 * 3. Sign and send transaction
 * 4. Wait for confirmation
 * 5. Return result with signature
 */

import { JupiterSwapService, SwapQuote } from "../../services/jupiter-swap.js";
import { SolanaService, SendTransactionResult } from "../../services/solana.js";
import { TOKEN_MINTS } from "../../services/price.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { AssetSymbol } from "../../types/portfolio.js";
import { logger } from "../../services/logger.js";

export type ExecuteSwapResult =
  | {
      status: "success";
      quote: SwapQuote;
      signature: string;
      confirmed: boolean;
    }
  | { status: "unavailable" }
  | { status: "no_wallet" }
  | { status: "invalid_amount"; message: string }
  | { status: "invalid_asset"; message: string }
  | { status: "quote_error"; message: string }
  | { status: "build_error"; message: string }
  | { status: "send_error"; message: string };

const SUPPORTED_ASSETS: AssetSymbol[] = ["BTC", "ETH", "SOL"];

export class ExecuteSwapUseCase {
  constructor(
    private jupiterSwap: JupiterSwapService | undefined,
    private solanaService: SolanaService,
    private userRepository: UserRepository,
    private devPrivateKey?: string,
  ) {}

  /**
   * Execute USDC → asset swap
   * @param telegramId User's Telegram ID
   * @param amountUsdc Amount of USDC to spend
   * @param asset Target asset (BTC, ETH, SOL). Defaults to SOL.
   */
  async execute(
    telegramId: number,
    amountUsdc: number,
    asset: string = "SOL",
  ): Promise<ExecuteSwapResult> {
    logger.info("ExecuteSwap", "Starting swap execution", {
      telegramId,
      amountUsdc,
      asset,
    });

    // Check if Jupiter is available
    if (!this.jupiterSwap) {
      logger.warn("ExecuteSwap", "Jupiter service unavailable");
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

    // Get user's wallet info
    let walletAddress: string | undefined;
    let privateKey: string | undefined;

    if (this.devPrivateKey) {
      // In dev mode, use dev wallet
      privateKey = this.devPrivateKey;
      walletAddress = await this.solanaService.getAddressFromPrivateKey(this.devPrivateKey);
    } else {
      // Get user's wallet from database
      const user = await this.userRepository.getById(telegramId);
      if (user?.privateKey) {
        privateKey = user.privateKey;
        walletAddress = user.walletAddress ?? undefined;
      }
    }

    if (!walletAddress || !privateKey) {
      return { status: "no_wallet" };
    }

    const outputMint = TOKEN_MINTS[assetUpper];

    // Step 1: Get quote
    logger.step("ExecuteSwap", 1, 3, "Getting quote from Jupiter...");
    let quote: SwapQuote;
    try {
      quote = await this.jupiterSwap.getQuoteUsdcToToken(amountUsdc, outputMint);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("ExecuteSwap", "Quote failed", { error: message });
      return { status: "quote_error", message };
    }

    // Step 2: Build transaction
    logger.step("ExecuteSwap", 2, 3, "Building transaction...");
    let transactionBase64: string;
    try {
      const swapTx = await this.jupiterSwap.buildSwapTransaction(quote, walletAddress);
      transactionBase64 = swapTx.transactionBase64;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("ExecuteSwap", "Build failed", { error: message });
      return { status: "build_error", message };
    }

    // Step 3: Sign and send transaction
    logger.step("ExecuteSwap", 3, 3, "Signing and sending transaction...");
    let sendResult: SendTransactionResult;
    try {
      sendResult = await this.solanaService.signAndSendTransaction(transactionBase64, privateKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("ExecuteSwap", "Send failed", { error: message });
      return { status: "send_error", message };
    }

    if (!sendResult.success || !sendResult.signature) {
      logger.error("ExecuteSwap", "Transaction failed", {
        error: sendResult.error,
      });
      return {
        status: "send_error",
        message: sendResult.error ?? "Transaction failed",
      };
    }

    logger.info("ExecuteSwap", "Swap completed", {
      signature: sendResult.signature,
      confirmed: sendResult.confirmed,
      inputAmount: `${quote.inputAmount} ${quote.inputSymbol}`,
      outputAmount: `${quote.outputAmount} ${quote.outputSymbol}`,
    });

    return {
      status: "success",
      quote,
      signature: sendResult.signature,
      confirmed: sendResult.confirmed,
    };
  }
}
