/**
 * Execute purchase use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaService, MOCK_PRICES } from "../../services/dca.js";
import { PurchaseResult } from "./types.js";

export class ExecutePurchaseUseCase {
  constructor(
    private userRepository: UserRepository,
    private dca: DcaService | undefined,
  ) {}

  async execute(telegramId: number, amountSol: number): Promise<PurchaseResult> {
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

    const balanceCheck = await this.dca.checkSolBalance(user.walletAddress, amountSol);
    if (!balanceCheck.sufficient) {
      return {
        type: "insufficient_balance",
        requiredBalance: amountSol,
        availableBalance: balanceCheck.balance,
      };
    }

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
