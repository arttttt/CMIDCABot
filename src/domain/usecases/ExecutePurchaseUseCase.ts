/**
 * Execute purchase use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaService, MOCK_PRICES } from "../../services/dca.js";
import { PurchaseResult } from "./types.js";
import { logger } from "../../services/logger.js";

export class ExecutePurchaseUseCase {
  constructor(
    private userRepository: UserRepository,
    private dca: DcaService | undefined,
  ) {}

  async execute(telegramId: number, amountSol: number): Promise<PurchaseResult> {
    logger.info("ExecutePurchase", "Executing mock purchase", {
      telegramId,
      amountSol,
    });

    if (!this.dca) {
      logger.warn("ExecutePurchase", "DCA service unavailable");
      return { type: "unavailable" };
    }

    if (!this.dca.isMockMode()) {
      logger.warn("ExecutePurchase", "Not in mock mode");
      return { type: "unavailable" };
    }

    if (isNaN(amountSol) || amountSol <= 0) {
      logger.warn("ExecutePurchase", "Invalid amount", { amountSol });
      return { type: "invalid_amount" };
    }

    await this.userRepository.create(telegramId);
    const user = await this.userRepository.getById(telegramId);

    if (!user?.walletAddress) {
      logger.warn("ExecutePurchase", "No wallet connected", { telegramId });
      return { type: "no_wallet" };
    }

    const balanceCheck = await this.dca.checkSolBalance(user.walletAddress, amountSol);
    if (!balanceCheck.sufficient) {
      logger.warn("ExecutePurchase", "Insufficient balance", {
        required: amountSol,
        available: balanceCheck.balance,
      });
      return {
        type: "insufficient_balance",
        requiredBalance: amountSol,
        availableBalance: balanceCheck.balance,
      };
    }

    const result = await this.dca.executeMockPurchase(telegramId, amountSol);

    if (!result.success) {
      logger.error("ExecutePurchase", "Purchase failed", { error: result.message });
      return {
        type: "failed",
        error: result.message,
      };
    }

    const priceUsd = MOCK_PRICES[result.asset];
    const valueUsd = result.amount * priceUsd;

    logger.info("ExecutePurchase", "Purchase completed", {
      telegramId,
      asset: result.asset,
      amount: result.amount,
      valueUsd,
    });

    return {
      type: "success",
      asset: result.asset,
      amountAsset: result.amount,
      amountSol,
      priceUsd,
      valueUsd,
    };
  }
}
