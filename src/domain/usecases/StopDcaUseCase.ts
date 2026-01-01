/**
 * Stop DCA use case
 */

import type { TelegramId } from "../../types/id/index.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { DcaScheduler } from "../../_wip/dca-scheduling/index.js";
import { DcaStopResult } from "./types.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class StopDcaUseCase {
  constructor(
    private userRepository: UserRepository,
    private dcaScheduler: DcaScheduler | undefined,
  ) {}

  async execute(telegramId: TelegramId): Promise<DcaStopResult> {
    logger.info("StopDca", "Stopping DCA", { telegramId });

    if (!this.dcaScheduler) {
      logger.warn("StopDca", "DCA scheduler unavailable");
      return { type: "unavailable" };
    }

    const user = await this.userRepository.getById(telegramId);

    if (!user?.isDcaActive) {
      logger.debug("StopDca", "DCA not active", { telegramId });
      return {
        type: "not_active",
        isSchedulerRunning: this.dcaScheduler.getIsRunning(),
      };
    }

    await this.userRepository.setDcaActive(telegramId, false);
    await this.dcaScheduler.onUserStatusChanged();

    logger.info("StopDca", "DCA stopped", {
      telegramId,
      isSchedulerRunning: this.dcaScheduler.getIsRunning(),
    });

    return {
      type: "stopped",
      isSchedulerRunning: this.dcaScheduler.getIsRunning(),
    };
  }
}
