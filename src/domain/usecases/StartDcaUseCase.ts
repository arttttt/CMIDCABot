/**
 * Start DCA use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaScheduler } from "../../services/DcaScheduler.js";
import { DcaStartResult } from "./types.js";

export class StartDcaUseCase {
  constructor(
    private userRepository: UserRepository,
    private dcaScheduler: DcaScheduler | undefined,
  ) {}

  async execute(telegramId: number): Promise<DcaStartResult> {
    if (!this.dcaScheduler) {
      return { type: "unavailable" };
    }

    await this.userRepository.create(telegramId);
    const user = await this.userRepository.getById(telegramId);

    if (!user?.walletAddress) {
      return { type: "no_wallet" };
    }

    if (user.isDcaActive) {
      return {
        type: "already_active",
        isSchedulerRunning: this.dcaScheduler.getIsRunning(),
      };
    }

    await this.userRepository.setDcaActive(telegramId, true);
    await this.dcaScheduler.onUserStatusChanged();

    return {
      type: "started",
      isSchedulerRunning: this.dcaScheduler.getIsRunning(),
    };
  }
}
