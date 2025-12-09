/**
 * Reset command handler (dev mode only)
 */

import {
  MessageContext,
  ServiceContext,
  MessageResponse,
} from "../../types/handlers.js";

export async function handleResetCommand(
  _args: string[],
  ctx: MessageContext,
  services: ServiceContext,
): Promise<MessageResponse> {
  if (!services.dca || !services.dca.isMockMode()) {
    return {
      text: "Portfolio reset is only available in development mode.",
    };
  }

  services.dca.resetPortfolio(ctx.telegramId);

  return {
    text:
      "Portfolio Reset Complete\n" +
      "─".repeat(25) + "\n\n" +
      "All balances set to 0.\n" +
      "Purchase history cleared.\n\n" +
      "Use /buy <amount> to start fresh.",
  };
}
