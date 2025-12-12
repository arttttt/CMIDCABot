/**
 * Get balance use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { SolanaService } from "../../services/solana.js";
import { BalanceResult } from "./types.js";

export class GetBalanceUseCase {
  constructor(
    private userRepository: UserRepository,
    private solana: SolanaService,
  ) {}

  async execute(telegramId: number): Promise<BalanceResult> {
    await this.userRepository.create(telegramId);
    const user = await this.userRepository.getById(telegramId);

    if (!user?.walletAddress) {
      return { type: "no_wallet" };
    }

    try {
      const balance = await this.solana.getBalance(user.walletAddress);
      return {
        type: "success",
        wallet: { address: user.walletAddress, balance },
      };
    } catch {
      return { type: "fetch_error" };
    }
  }
}
