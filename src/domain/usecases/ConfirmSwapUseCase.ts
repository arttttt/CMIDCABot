/**
 * ConfirmSwapUseCase - confirms a pending swap session and executes it
 *
 * Resolves the session (ownership, slippage re-confirm policy) and, once
 * consumed, runs the swap. After consumption the session is never cancelled:
 * an unexpected failure surfaces as a send_error result so a possibly
 * on-chain transaction is not masked by a generic message.
 */

import type { TelegramId, ConfirmationSessionId } from "../models/id/index.js";
import type { SwapResult } from "../models/SwapStep.js";
import type { ExecuteSwapUseCase } from "./ExecuteSwapUseCase.js";
import type {
  ResolveConfirmationSessionUseCase,
  ResolveConfirmationResult,
} from "./ResolveConfirmationSessionUseCase.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export type ConfirmSwapResult =
  | Exclude<ResolveConfirmationResult, { kind: "confirmed" }>
  | { kind: "executed"; result: SwapResult };

export class ConfirmSwapUseCase {
  constructor(
    private resolveConfirmationSession: ResolveConfirmationSessionUseCase,
    private executeSwapUseCase: ExecuteSwapUseCase,
  ) {}

  async execute(
    sessionId: ConfirmationSessionId,
    telegramId: TelegramId,
  ): Promise<ConfirmSwapResult> {
    const resolved = await this.resolveConfirmationSession.execute(sessionId, telegramId);
    if (resolved.kind !== "confirmed") {
      return resolved;
    }

    const { session } = resolved;

    // Session is consumed - execute and report whatever actually happened
    try {
      let result: SwapResult = { status: "send_error", message: "Swap did not complete" };
      for await (const step of this.executeSwapUseCase.execute(
        telegramId,
        session.amount,
        session.asset,
      )) {
        if (step.step === "completed") {
          result = step.result;
        }
      }
      return { kind: "executed", result };
    } catch (error) {
      logger.error("ConfirmSwap", "Swap execution failed unexpectedly", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        kind: "executed",
        result: {
          status: "send_error",
          message: "Swap execution failed - check your balance and transaction history",
        },
      };
    }
  }
}
