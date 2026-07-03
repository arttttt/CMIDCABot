/**
 * CancelConfirmationUseCase - cancels a pending confirmation session
 */

import type { TelegramId, ConfirmationSessionId } from "../models/id/index.js";
import type {
  ConfirmationRepository,
  ConfirmationType,
} from "../repositories/ConfirmationRepository.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export type CancelConfirmationResult =
  | { kind: "session_not_found" }
  | { kind: "cancelled"; confirmationType: ConfirmationType };

export class CancelConfirmationUseCase {
  constructor(private confirmationRepository: ConfirmationRepository) {}

  async execute(
    sessionId: ConfirmationSessionId,
    telegramId: TelegramId,
  ): Promise<CancelConfirmationResult> {
    const session = this.confirmationRepository.get(sessionId);
    if (!session) {
      return { kind: "session_not_found" };
    }

    // Check if session belongs to this user
    if (!session.telegramId.equals(telegramId)) {
      logger.warn("ConfirmationFlow", "Cancel session user mismatch", {
        sessionUser: session.telegramId.value,
        requestUser: telegramId.value,
      });
      return { kind: "session_not_found" };
    }

    this.confirmationRepository.cancel(sessionId);
    return { kind: "cancelled", confirmationType: session.type };
  }
}
