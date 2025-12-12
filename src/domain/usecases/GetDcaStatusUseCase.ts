/**
 * Get DCA status use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaScheduler } from "../../services/DcaScheduler.js";
import { DcaStatusResult } from "./types.js";

export class GetDcaStatusUseCase {
  constructor(
    private userRepository: UserRepository,
    private dcaScheduler: DcaScheduler | undefined,
  ) {}

  async execute(telegramId: number): Promise<DcaStatusResult> {
    if (!this.dcaScheduler) {
      return { type: "unavailable" };
    }

    const user = await this.userRepository.getById(telegramId);

    if (!user?.walletAddress) {
      return { type: "no_wallet" };
    }

    if (user.isDcaActive) {
      return {
        type: "active",
        isSchedulerRunning: this.dcaScheduler.getIsRunning(),
      };
    }

    return {
      type: "inactive",
      isSchedulerRunning: this.dcaScheduler.getIsRunning(),
    };
  }
}
