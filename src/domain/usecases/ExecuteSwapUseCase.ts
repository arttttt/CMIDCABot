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
 *
 * Streams progress via execute() AsyncGenerator.
 */

import { JupiterSwapService, SwapQuote } from "../../services/jupiter-swap.js";
import { SolanaService, SendTransactionResult } from "../../services/solana.js";
import { TOKEN_MINTS } from "../../services/price.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { TransactionRepository } from "../repositories/TransactionRepository.js";
import { BalanceRepository } from "../repositories/BalanceRepository.js";
import { AssetSymbol } from "../../types/portfolio.js";
import { logger } from "../../services/logger.js";
import type { KeyEncryptionService } from "../../services/encryption.js";
import { SwapStep, SwapSteps } from "../models/index.js";

const SUPPORTED_ASSETS: AssetSymbol[] = ["BTC", "ETH", "SOL"];

export class ExecuteSwapUseCase {
  constructor(
    private jupiterSwap: JupiterSwapService | undefined,
    private solanaService: SolanaService,
    private userRepository: UserRepository,
    private transactionRepository: TransactionRepository,
    private balanceRepository: BalanceRepository,
    private encryptionService: KeyEncryptionService,
    private devPrivateKey?: string,
  ) {}

  /**
   * Execute USDC → asset swap with streaming progress
   * @param telegramId User's Telegram ID
   * @param amountUsdc Amount of USDC to spend
   * @param asset Target asset (BTC, ETH, SOL). Defaults to SOL.
   * @yields SwapStep - progress updates and final result
   */
  async *execute(
    telegramId: number,
    amountUsdc: number,
    asset: string = "SOL",
  ): AsyncGenerator<SwapStep> {
    logger.info("ExecuteSwap", "Starting swap execution", {
      telegramId,
      amountUsdc,
      asset,
    });

    // Check if Jupiter is available
    if (!this.jupiterSwap) {
      logger.warn("ExecuteSwap", "Jupiter service unavailable");
      yield SwapSteps.completed({ status: "unavailable" });
      return;
    }

    // Validate amount
    if (isNaN(amountUsdc) || amountUsdc <= 0) {
      yield SwapSteps.completed({
        status: "invalid_amount",
        message: "Amount must be a positive number",
      });
      return;
    }

    if (amountUsdc < 0.01) {
      yield SwapSteps.completed({
        status: "invalid_amount",
        message: "Minimum amount is 0.01 USDC",
      });
      return;
    }

    // Validate asset
    const assetUpper = asset.toUpperCase() as AssetSymbol;
    if (!SUPPORTED_ASSETS.includes(assetUpper)) {
      yield SwapSteps.completed({
        status: "invalid_asset",
        message: `Unsupported asset: ${asset}. Supported: ${SUPPORTED_ASSETS.join(", ")}`,
      });
      return;
    }

    // Get user's wallet info
    let walletAddress: string | undefined;
    let encryptedPrivateKey: string | undefined;
    let useDevKey = false;

    if (this.devPrivateKey) {
      // In dev mode, use dev wallet (key is plaintext from env)
      useDevKey = true;
      walletAddress = await this.solanaService.getAddressFromPrivateKey(this.devPrivateKey);
    } else {
      // Get user's wallet from database (key is encrypted)
      const user = await this.userRepository.getById(telegramId);
      if (user?.privateKey) {
        encryptedPrivateKey = user.privateKey;
        walletAddress = user.walletAddress ?? undefined;
      }
    }

    if (!walletAddress || (!useDevKey && !encryptedPrivateKey)) {
      yield SwapSteps.completed({ status: "no_wallet" });
      return;
    }

    // Check USDC balance before calling Jupiter API (uses cache)
    let usdcBalance: number;
    try {
      usdcBalance = await this.balanceRepository.getUsdcBalance(walletAddress);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("ExecuteSwap", "Failed to fetch USDC balance", { error: message });
      yield SwapSteps.completed({ status: "rpc_error", message });
      return;
    }

    if (usdcBalance < amountUsdc) {
      logger.warn("ExecuteSwap", "Insufficient USDC balance", {
        required: amountUsdc,
        available: usdcBalance,
      });
      yield SwapSteps.completed({
        status: "insufficient_balance",
        required: amountUsdc,
        available: usdcBalance,
      });
      return;
    }

    const outputMint = TOKEN_MINTS[assetUpper];

    // Step 1: Get quote
    yield SwapSteps.gettingQuote();
    logger.step("ExecuteSwap", 1, 3, "Getting quote from Jupiter...");

    let quote: SwapQuote;
    try {
      quote = await this.jupiterSwap.getQuoteUsdcToToken(amountUsdc, outputMint);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("ExecuteSwap", "Quote failed", { error: message });
      yield SwapSteps.completed({ status: "quote_error", message });
      return;
    }

    // Emit quote received with data
    yield SwapSteps.quoteReceived({
      inputAmount: quote.inputAmount,
      inputSymbol: quote.inputSymbol,
      outputAmount: quote.outputAmount,
      outputSymbol: quote.outputSymbol,
      priceImpactPct: quote.priceImpactPct,
      slippageBps: quote.slippageBps,
      route: quote.route,
    });

    // Step 2: Build transaction
    yield SwapSteps.buildingTransaction();
    logger.step("ExecuteSwap", 2, 3, "Building transaction...");

    let transactionBase64: string;
    try {
      const swapTx = await this.jupiterSwap.buildSwapTransaction(quote, walletAddress);
      transactionBase64 = swapTx.transactionBase64;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("ExecuteSwap", "Build failed", { error: message });
      yield SwapSteps.completed({ status: "build_error", message });
      return;
    }

    // Step 3: Sign and send transaction
    yield SwapSteps.sendingTransaction();
    logger.step("ExecuteSwap", 3, 3, "Signing and sending transaction...");

    let sendResult: SendTransactionResult;
    try {
      if (useDevKey && this.devPrivateKey) {
        // Dev mode: use plaintext key
        sendResult = await this.solanaService.signAndSendTransaction(
          transactionBase64,
          this.devPrivateKey,
        );
      } else {
        // Production: use encrypted key with secure signing
        sendResult = await this.solanaService.signAndSendTransactionSecure(
          transactionBase64,
          encryptedPrivateKey!,
          this.encryptionService,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("ExecuteSwap", "Send failed", { error: message });
      yield SwapSteps.completed({ status: "send_error", message });
      return;
    }

    if (!sendResult.success || !sendResult.signature) {
      logger.error("ExecuteSwap", "Transaction failed", {
        error: sendResult.error,
      });
      yield SwapSteps.completed({
        status: "send_error",
        message: sendResult.error ?? "Transaction failed",
      });
      return;
    }

    // Invalidate balance cache after successful transaction
    this.balanceRepository.invalidate(walletAddress);

    // Save transaction to database
    try {
      await this.transactionRepository.create({
        telegramId,
        txSignature: sendResult.signature,
        assetSymbol: assetUpper,
        amountUsdc,
        amountAsset: quote.outputAmount,
      });
      logger.debug("ExecuteSwap", "Transaction saved to database");
    } catch (error) {
      // Don't fail the swap if saving fails - the swap already happened
      logger.warn("ExecuteSwap", "Failed to save transaction to database", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logger.info("ExecuteSwap", "Swap completed", {
      signature: sendResult.signature,
      confirmed: sendResult.confirmed,
      inputAmount: `${quote.inputAmount} ${quote.inputSymbol}`,
      outputAmount: `${quote.outputAmount} ${quote.outputSymbol}`,
    });

    yield SwapSteps.completed({
      status: "success",
      quote,
      signature: sendResult.signature,
      confirmed: sendResult.confirmed,
    });
  }
}
