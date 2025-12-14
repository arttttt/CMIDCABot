/**
 * Execute purchase use case - real swap via Jupiter
 * Automatically selects the asset furthest below target allocation
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { TransactionRepository } from "../repositories/TransactionRepository.js";
import { JupiterSwapService, SwapQuote } from "../../services/jupiter-swap.js";
import { SolanaService, SendTransactionResult } from "../../services/solana.js";
import { PriceService, TOKEN_MINTS } from "../../services/price.js";
import { TOKEN_DECIMALS } from "../../services/jupiter-swap.js";
import { AssetSymbol, TARGET_ALLOCATIONS } from "../../types/portfolio.js";
import { PurchaseResult } from "./types.js";
import { logger } from "../../services/logger.js";

export class ExecutePurchaseUseCase {
  constructor(
    private userRepository: UserRepository,
    private transactionRepository: TransactionRepository,
    private jupiterSwap: JupiterSwapService | undefined,
    private solanaService: SolanaService,
    private priceService: PriceService | undefined,
    private devPrivateKey?: string,
  ) {}

  async execute(telegramId: number, amountUsdc: number): Promise<PurchaseResult> {
    logger.info("ExecutePurchase", "Executing portfolio purchase", {
      telegramId,
      amountUsdc,
    });

    // Check if Jupiter is available
    if (!this.jupiterSwap || !this.priceService) {
      logger.warn("ExecutePurchase", "Jupiter or Price service unavailable");
      return { type: "unavailable" };
    }

    // Validate amount
    if (isNaN(amountUsdc) || amountUsdc <= 0) {
      logger.warn("ExecutePurchase", "Invalid amount", { amountUsdc });
      return { type: "invalid_amount" };
    }

    if (amountUsdc < 0.01) {
      return {
        type: "invalid_amount",
        error: "Minimum amount is 0.01 USDC",
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
      logger.warn("ExecutePurchase", "No wallet connected", { telegramId });
      return { type: "no_wallet" };
    }

    // Check USDC balance
    const usdcBalance = await this.solanaService.getUsdcBalance(walletAddress);
    if (usdcBalance < amountUsdc) {
      logger.warn("ExecutePurchase", "Insufficient USDC balance", {
        required: amountUsdc,
        available: usdcBalance,
      });
      return {
        type: "insufficient_balance",
        requiredBalance: amountUsdc,
        availableBalance: usdcBalance,
      };
    }

    // Determine which asset to buy based on portfolio allocation
    const assetToBuy = await this.selectAssetToBuy(walletAddress);
    logger.info("ExecutePurchase", "Selected asset to buy", { asset: assetToBuy });

    const outputMint = TOKEN_MINTS[assetToBuy];

    // Step 1: Get quote
    logger.step("ExecutePurchase", 1, 3, "Getting quote from Jupiter...");
    let quote: SwapQuote;
    try {
      quote = await this.jupiterSwap.getQuoteUsdcToToken(amountUsdc, outputMint);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("ExecutePurchase", "Quote failed", { error: message });
      return { type: "quote_error", error: message };
    }

    // Step 2: Build transaction
    logger.step("ExecutePurchase", 2, 3, "Building transaction...");
    let transactionBase64: string;
    try {
      const swapTx = await this.jupiterSwap.buildSwapTransaction(quote, walletAddress);
      transactionBase64 = swapTx.transactionBase64;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("ExecutePurchase", "Build failed", { error: message });
      return { type: "build_error", error: message };
    }

    // Step 3: Sign and send transaction
    logger.step("ExecutePurchase", 3, 3, "Signing and sending transaction...");
    let sendResult: SendTransactionResult;
    try {
      sendResult = await this.solanaService.signAndSendTransaction(transactionBase64, privateKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("ExecutePurchase", "Send failed", { error: message });
      return { type: "send_error", error: message };
    }

    if (!sendResult.success || !sendResult.signature) {
      logger.error("ExecutePurchase", "Transaction failed", {
        error: sendResult.error,
      });
      return {
        type: "send_error",
        error: sendResult.error ?? "Transaction failed",
      };
    }

    // Calculate price from quote
    const priceUsd = amountUsdc / quote.outputAmount;

    // Save transaction to database
    try {
      await this.transactionRepository.create({
        telegramId,
        txSignature: sendResult.signature,
        assetSymbol: assetToBuy,
        amountUsdc,
        amountAsset: quote.outputAmount,
      });
      logger.debug("ExecutePurchase", "Transaction saved to database");
    } catch (error) {
      // Don't fail the purchase if saving fails - the swap already happened
      logger.warn("ExecutePurchase", "Failed to save transaction to database", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logger.info("ExecutePurchase", "Purchase completed", {
      signature: sendResult.signature,
      confirmed: sendResult.confirmed,
      asset: assetToBuy,
      amount: quote.outputAmount,
      amountUsdc,
      priceUsd,
    });

    return {
      type: "success",
      asset: assetToBuy,
      amountAsset: quote.outputAmount,
      amountUsdc,
      priceUsd,
      signature: sendResult.signature,
      confirmed: sendResult.confirmed,
    };
  }

  /**
   * Select asset to buy based on portfolio allocation
   * Returns the asset that is furthest below its target allocation
   */
  private async selectAssetToBuy(walletAddress: string): Promise<AssetSymbol> {
    try {
      // Fetch balances in parallel
      const [solBalance, btcBalance, ethBalance, prices] = await Promise.all([
        this.solanaService.getBalance(walletAddress),
        this.solanaService.getTokenBalance(walletAddress, TOKEN_MINTS.BTC, TOKEN_DECIMALS.BTC),
        this.solanaService.getTokenBalance(walletAddress, TOKEN_MINTS.ETH, TOKEN_DECIMALS.ETH),
        this.priceService!.getPricesRecord(),
      ]);

      // Calculate values in USD
      const assets: { symbol: AssetSymbol; valueInUsdc: number }[] = [
        { symbol: "BTC", valueInUsdc: btcBalance * prices.BTC },
        { symbol: "ETH", valueInUsdc: ethBalance * prices.ETH },
        { symbol: "SOL", valueInUsdc: solBalance * prices.SOL },
      ];

      const totalValueInUsdc = assets.reduce((sum, a) => sum + a.valueInUsdc, 0);

      // If portfolio is empty, buy BTC (largest target allocation)
      if (totalValueInUsdc === 0) {
        return "BTC";
      }

      // Find asset with maximum negative deviation (most below target)
      let assetToBuy: AssetSymbol = "BTC";
      let maxNegativeDeviation = 0;

      for (const asset of assets) {
        const currentAllocation = asset.valueInUsdc / totalValueInUsdc;
        const targetAllocation = TARGET_ALLOCATIONS[asset.symbol];
        const deviation = currentAllocation - targetAllocation;

        if (deviation < maxNegativeDeviation) {
          maxNegativeDeviation = deviation;
          assetToBuy = asset.symbol;
        }
      }

      return assetToBuy;
    } catch (error) {
      logger.warn("ExecutePurchase", "Failed to calculate allocations, defaulting to BTC", {
        error: error instanceof Error ? error.message : String(error),
      });
      return "BTC";
    }
  }
}
