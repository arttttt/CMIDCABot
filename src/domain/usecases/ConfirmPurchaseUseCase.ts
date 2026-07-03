/**
 * ConfirmPurchaseUseCase - confirms a pending purchase session and executes it
 *
 * Resolves the session (ownership, slippage re-confirm policy) and, once
 * consumed, streams the purchase execution. After consumption the session is
 * never cancelled: an unexpected failure surfaces as a send_error result so a
 * possibly on-chain transaction is not masked by a generic message.
 */

import type { TelegramId, ConfirmationSessionId } from "../models/id/index.js";
import type { PurchaseStep } from "../models/index.js";
import { PurchaseSteps } from "../models/index.js";
import type { ExecutePurchaseUseCase } from "./ExecutePurchaseUseCase.js";
import type {
  ResolveConfirmationSessionUseCase,
  ResolveConfirmationResult,
} from "./ResolveConfirmationSessionUseCase.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export type ConfirmPurchaseStep =
  | { step: "resolution"; outcome: Exclude<ResolveConfirmationResult, { kind: "confirmed" }> }
  | { step: "purchase"; purchaseStep: PurchaseStep };

export class ConfirmPurchaseUseCase {
  constructor(
    private resolveConfirmationSession: ResolveConfirmationSessionUseCase,
    private executePurchaseUseCase: ExecutePurchaseUseCase,
  ) {}

  async *execute(
    sessionId: ConfirmationSessionId,
    telegramId: TelegramId,
  ): AsyncGenerator<ConfirmPurchaseStep> {
    const resolved = await this.resolveConfirmationSession.execute(sessionId, telegramId);
    if (resolved.kind !== "confirmed") {
      yield { step: "resolution", outcome: resolved };
      return;
    }

    const { session } = resolved;

    // Session is consumed - execute and report whatever actually happened
    try {
      for await (const purchaseStep of this.executePurchaseUseCase.execute(
        telegramId,
        session.amount,
      )) {
        yield { step: "purchase", purchaseStep };
      }
    } catch (error) {
      logger.error("ConfirmPurchase", "Purchase execution failed unexpectedly", {
        error: error instanceof Error ? error.message : String(error),
      });
      yield {
        step: "purchase",
        purchaseStep: PurchaseSteps.completed({
          status: "send_error",
          message: "Purchase execution failed - check your balance and transaction history",
        }),
      };
    }
  }
}
