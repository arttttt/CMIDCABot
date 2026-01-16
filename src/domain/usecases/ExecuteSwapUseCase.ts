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

import type { TelegramId, WalletAddress } from "../models/id/index.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { TransactionRepository } from "../repositories/TransactionRepository.js";
import { BalanceRepository } from "../repositories/BalanceRepository.js";
import { BlockchainRepository, SendTransactionResult } from "../repositories/BlockchainRepository.js";
import { SwapRepository } from "../repositories/SwapRepository.js";
import { OperationLockRepository } from "../repositories/OperationLockRepository.js";
import type { SwapQuote } from "../models/quote/SwapQuote.js";
import { AssetSymbol } from "../../types/portfolio.js";
import { logger } from "../../infrastructure/shared/logging/index.js";
import { SwapStep, SwapSteps } from "../models/index.js";
import { MIN_SOL_AMOUNT, MIN_USDC_AMOUNT, MAX_USDC_AMOUNT, MAX_PRICE_IMPACT_BPS } from "../constants.js";
import { BalanceOperationLock } from "../constants/BalanceOperationLock.js";

const SUPPORTED_ASSETS: AssetSymbol[] = ["BTC", "ETH", "SOL"];

export class ExecuteSwapUseCase {
  constructor(
    private swapRepository: SwapRepository | undefined,
    private blockchainRepository: BlockchainRepository,
    private userRepository: UserRepository,
    private transactionRepository: TransactionRepository,
    private balanceRepository: BalanceRepository,
    private operationLockRepository: OperationLockRepository,
  ) {}

  /**
   * Execute USDC → asset swap with streaming progress
   * @param telegramId User's Telegram ID
   * @param amountUsdc Amount of USDC to spend
   * @param asset Target asset (BTC, ETH, SOL). Defaults to SOL.
   * @yields SwapStep - progress updates and final result
   */
  async *execute(
    telegramId: TelegramId,
    amountUsdc: number,
    asset: string = "SOL",
    options: { skipLock?: boolean } = {},
  ): AsyncGenerator<SwapStep> {
    logger.info("ExecuteSwap", "Starting swap execution", {
      telegramId,
      amountUsdc,
      asset,
    });

    // Check if swap repository is available
    if (!this.swapRepository) {
      logger.warn("ExecuteSwap", "Swap repository unavailable");
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

    if (amountUsdc < MIN_USDC_AMOUNT) {
      yield SwapSteps.completed({
        status: "invalid_amount",
        message: `Minimum amount is ${MIN_USDC_AMOUNT} USDC`,
      });
      return;
    }

    if (amountUsdc > MAX_USDC_AMOUNT) {
      yield SwapSteps.completed({
        status: "invalid_amount",
        message: `Maximum amount is ${MAX_USDC_AMOUNT} USDC`,
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
    const shouldSkipLock = options.skipLock ?? false;
    const lockKey = BalanceOperationLock.getKey(telegramId);
    let lockAcquired = false;

    if (!shouldSkipLock) {
      lockAcquired = await this.operationLockRepository.acquire(
        lockKey,
        BalanceOperationLock.TTL_MS,
        Date.now(),
      );

      if (!lockAcquired) {
        yield SwapSteps.completed({ status: "operation_in_progress" });
        return;
      }
    }

    try {
      yield* this.executeInternal(telegramId, amountUsdc, assetUpper);
    } finally {
      if (!shouldSkipLock && lockAcquired) {
        await this.operationLockRepository.release(lockKey);
      }
    }
  }

  private async *executeInternal(
    telegramId: TelegramId,
    amountUsdc: number,
    assetUpper: AssetSymbol,
  ): AsyncGenerator<SwapStep> {
    // Get user's wallet info
    let walletAddr: WalletAddress | undefined;
    let encryptedPrivateKey: string | undefined;

    // Get user's wallet from database (key is encrypted)
    const user = await this.userRepository.getById(telegramId);
    if (user?.privateKey) {
      encryptedPrivateKey = user.privateKey;
      walletAddr = user?.walletAddress ?? undefined;
    }

    if (!walletAddr || !encryptedPrivateKey) {
      yield SwapSteps.completed({ status: "no_wallet" });
      return;
    }

    // Check USDC balance before calling Jupiter API (uses cache)
    yield SwapSteps.checkingBalance();

    let usdcBalance: number;
    try {
      usdcBalance = await this.balanceRepository.getUsdcBalance(walletAddr);
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
        status: "insufficient_usdc_balance",
      });
      return;
    }

    // Check SOL balance for transaction fees
    let solBalance: number;
    try {
      solBalance = await this.balanceRepository.getSolBalance(walletAddr);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("ExecuteSwap", "Failed to fetch SOL balance", { error: message });
      yield SwapSteps.completed({ status: "rpc_error", message });
      return;
    }

    if (solBalance < MIN_SOL_AMOUNT) {
      logger.warn("ExecuteSwap", "Insufficient SOL for fees", {
        required: MIN_SOL_AMOUNT,
        available: solBalance,
      });
      yield SwapSteps.completed({ status: "insufficient_sol_balance" });
      return;
    }

    // Step 1: Get quote
    yield SwapSteps.gettingQuote();
    logger.step("ExecuteSwap", 1, 3, "Getting quote from Jupiter...");

    let quote: SwapQuote;
    try {
      quote = await this.swapRepository!.getQuoteUsdcToAsset(amountUsdc, assetUpper);
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

    // Validate price impact before building transaction
    const priceImpactBps = quote.priceImpactPct * 100;
    if (priceImpactBps > MAX_PRICE_IMPACT_BPS) {
      logger.warn("ExecuteSwap", "Price impact too high", {
        priceImpactPct: quote.priceImpactPct,
        priceImpactBps,
        maxAllowedBps: MAX_PRICE_IMPACT_BPS,
      });
      yield SwapSteps.completed({
        status: "high_price_impact",
        priceImpactPct: quote.priceImpactPct,
      });
      return;
    }

    // Step 2: Build transaction
    yield SwapSteps.buildingTransaction();
    logger.step("ExecuteSwap", 2, 3, "Building transaction...");

    let transactionBase64: string;
    try {
      const swapTx = await this.swapRepository!.buildSwapTransaction(quote, walletAddr);
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
      sendResult = await this.blockchainRepository.signAndSendTransactionSecure(
        transactionBase64,
        encryptedPrivateKey,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("ExecuteSwap", "Send failed", { error: message });
      yield SwapSteps.completed({ status: "send_error", message });
      return;
    }

    if (!sendResult.success) {
      logger.error("ExecuteSwap", "Transaction failed", {
        error: sendResult.error,
        signature: sendResult.signature,
      });
      yield SwapSteps.completed({
        status: "send_error",
        message: sendResult.error ?? "Transaction failed",
        signature: sendResult.signature || undefined,
      });
      return;
    }

    if (!sendResult.signature) {
      logger.error("ExecuteSwap", "Transaction failed - no signature");
      yield SwapSteps.completed({
        status: "send_error",
        message: "Transaction failed - no signature returned",
      });
      return;
    }

    // Invalidate balance cache after successful transaction
    this.balanceRepository.invalidate(walletAddr);

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
