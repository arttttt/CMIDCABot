/**
 * Start DCA use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaScheduler } from "../../_wip/dca-scheduling/index.js";
import { DcaStartResult } from "./types.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class StartDcaUseCase {
  constructor(
    private userRepository: UserRepository,
    private dcaScheduler: DcaScheduler | undefined,
  ) {}

  async execute(telegramId: number): Promise<DcaStartResult> {
    logger.info("StartDca", "Starting DCA", { telegramId });

    if (!this.dcaScheduler) {
      logger.warn("StartDca", "DCA scheduler unavailable");
      return { type: "unavailable" };
    }

    await this.userRepository.create(telegramId);
    const user = await this.userRepository.getById(telegramId);

    if (!user?.walletAddress) {
      logger.warn("StartDca", "No wallet connected", { telegramId });
      return { type: "no_wallet" };
    }

    if (user.isDcaActive) {
      logger.debug("StartDca", "DCA already active", { telegramId });
      return {
        type: "already_active",
        isSchedulerRunning: this.dcaScheduler.getIsRunning(),
      };
    }

    await this.userRepository.setDcaActive(telegramId, true);
    await this.dcaScheduler.onUserStatusChanged();

    logger.info("StartDca", "DCA started", {
      telegramId,
      isSchedulerRunning: this.dcaScheduler.getIsRunning(),
    });

    return {
      type: "started",
      isSchedulerRunning: this.dcaScheduler.getIsRunning(),
    };
  }
}
