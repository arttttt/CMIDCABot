/**
 * Get DCA status use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaScheduler } from "../../services/DcaScheduler.js";
import { DcaStatusResult } from "./types.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class GetDcaStatusUseCase {
  constructor(
    private userRepository: UserRepository,
    private dcaScheduler: DcaScheduler | undefined,
  ) {}

  async execute(telegramId: number): Promise<DcaStatusResult> {
    logger.info("GetDcaStatus", "Getting DCA status", { telegramId });

    if (!this.dcaScheduler) {
      logger.warn("GetDcaStatus", "DCA scheduler unavailable");
      return { type: "unavailable" };
    }

    const user = await this.userRepository.getById(telegramId);

    if (!user?.walletAddress) {
      logger.warn("GetDcaStatus", "No wallet connected", { telegramId });
      return { type: "no_wallet" };
    }

    if (user.isDcaActive) {
      logger.debug("GetDcaStatus", "DCA is active", {
        telegramId,
        isSchedulerRunning: this.dcaScheduler.getIsRunning(),
      });
      return {
        type: "active",
        isSchedulerRunning: this.dcaScheduler.getIsRunning(),
      };
    }

    logger.debug("GetDcaStatus", "DCA is inactive", {
      telegramId,
      isSchedulerRunning: this.dcaScheduler.getIsRunning(),
    });
    return {
      type: "inactive",
      isSchedulerRunning: this.dcaScheduler.getIsRunning(),
    };
  }
}
