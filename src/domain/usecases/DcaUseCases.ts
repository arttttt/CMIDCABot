/**
 * DCA use cases - domain operations for starting/stopping DCA
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaScheduler } from "../../services/DcaScheduler.js";
import { DcaStartResult, DcaStopResult, DcaStatusResult } from "./types.js";

export class DcaUseCases {
  constructor(
    private userRepository: UserRepository,
    private dcaScheduler: DcaScheduler | undefined,
  ) {}

  /**
   * Start DCA for a user
   */
  async start(telegramId: number): Promise<DcaStartResult> {
    if (!this.dcaScheduler) {
      return { type: "unavailable" };
    }

    await this.userRepository.create(telegramId);
    const user = await this.userRepository.getById(telegramId);

    // Check if user has a wallet
    if (!user?.walletAddress) {
      return { type: "no_wallet" };
    }

    // Check if already active
    if (user.isDcaActive) {
      return {
        type: "already_active",
        isSchedulerRunning: this.dcaScheduler.getIsRunning(),
      };
    }

    // Activate DCA for user
    await this.userRepository.setDcaActive(telegramId, true);

    // Notify scheduler about status change
    await this.dcaScheduler.onUserStatusChanged();

    return {
      type: "started",
      isSchedulerRunning: this.dcaScheduler.getIsRunning(),
    };
  }

  /**
   * Stop DCA for a user
   */
  async stop(telegramId: number): Promise<DcaStopResult> {
    if (!this.dcaScheduler) {
      return { type: "unavailable" };
    }

    const user = await this.userRepository.getById(telegramId);

    // Check if DCA is active
    if (!user?.isDcaActive) {
      return {
        type: "not_active",
        isSchedulerRunning: this.dcaScheduler.getIsRunning(),
      };
    }

    // Deactivate DCA for user
    await this.userRepository.setDcaActive(telegramId, false);

    // Notify scheduler about status change
    await this.dcaScheduler.onUserStatusChanged();

    return {
      type: "stopped",
      isSchedulerRunning: this.dcaScheduler.getIsRunning(),
    };
  }

  /**
   * Get DCA status for a user
   */
  async getStatus(telegramId: number): Promise<DcaStatusResult> {
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
