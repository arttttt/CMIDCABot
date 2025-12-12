/**
 * Stop DCA use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaScheduler } from "../../services/DcaScheduler.js";
import { DcaStopResult } from "./types.js";

export class StopDcaUseCase {
  constructor(
    private userRepository: UserRepository,
    private dcaScheduler: DcaScheduler | undefined,
  ) {}

  async execute(telegramId: number): Promise<DcaStopResult> {
    if (!this.dcaScheduler) {
      return { type: "unavailable" };
    }

    const user = await this.userRepository.getById(telegramId);

    if (!user?.isDcaActive) {
      return {
        type: "not_active",
        isSchedulerRunning: this.dcaScheduler.getIsRunning(),
      };
    }

    await this.userRepository.setDcaActive(telegramId, false);
    await this.dcaScheduler.onUserStatusChanged();

    return {
      type: "stopped",
      isSchedulerRunning: this.dcaScheduler.getIsRunning(),
    };
  }
}
