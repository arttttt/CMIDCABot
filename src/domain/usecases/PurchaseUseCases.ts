/**
 * Purchase use cases - domain operations for asset purchases
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaService, MOCK_PRICES } from "../../services/dca.js";
import { PurchaseResult } from "./types.js";

export class PurchaseUseCases {
  constructor(
    private userRepository: UserRepository,
    private dca: DcaService | undefined,
  ) {}

  /**
   * Execute a mock purchase
   */
  async executePurchase(telegramId: number, amountSol: number): Promise<PurchaseResult> {
    if (!this.dca) {
      return { type: "unavailable" };
    }

    if (!this.dca.isMockMode()) {
      return { type: "unavailable" };
    }

    if (isNaN(amountSol) || amountSol <= 0) {
      return { type: "invalid_amount" };
    }

    await this.userRepository.create(telegramId);
    const user = await this.userRepository.getById(telegramId);

    if (!user?.walletAddress) {
      return { type: "no_wallet" };
    }

    // Check SOL balance (but don't deduct in mock mode)
    const balanceCheck = await this.dca.checkSolBalance(user.walletAddress, amountSol);
    if (!balanceCheck.sufficient) {
      return {
        type: "insufficient_balance",
        requiredBalance: amountSol,
        availableBalance: balanceCheck.balance,
      };
    }

    // Execute mock purchase
    const result = await this.dca.executeMockPurchase(telegramId, amountSol);

    if (!result.success) {
      return {
        type: "failed",
        error: result.message,
      };
    }

    const priceUsd = MOCK_PRICES[result.asset];
    const valueUsd = result.amount * priceUsd;

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
