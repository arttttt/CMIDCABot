/**
 * Status command handler (dev mode only)
 */

import {
  MessageContext,
  ServiceContext,
  MessageResponse,
} from "../../types/handlers.js";
import { TARGET_ALLOCATIONS } from "../../types/portfolio.js";

export async function handleStatusCommand(
  _args: string[],
  ctx: MessageContext,
  services: ServiceContext,
): Promise<MessageResponse> {
  if (!services.dca || !services.dca.isMockMode()) {
    return {
      text: "Portfolio tracking is only available in development mode.",
    };
  }

  await services.userRepository.create(ctx.telegramId);
  await services.dca.createPortfolio(ctx.telegramId);

  const status = await services.dca.getPortfolioStatus(ctx.telegramId);
  if (!status) {
    return {
      text: "Portfolio not found. Use /buy <amount> to make your first purchase.",
    };
  }

  if (status.totalValueInUsdc === 0) {
    return {
      text:
        "Your portfolio is empty.\n\n" +
        "Target allocations:\n" +
        `- BTC: ${(TARGET_ALLOCATIONS.BTC * 100).toFixed(0)}%\n` +
        `- ETH: ${(TARGET_ALLOCATIONS.ETH * 100).toFixed(0)}%\n` +
        `- SOL: ${(TARGET_ALLOCATIONS.SOL * 100).toFixed(0)}%\n\n` +
        "Use /buy <amount> to make a mock purchase.",
    };
  }

  let text = "Portfolio Status (Mock)\n";
  text += "─".repeat(25) + "\n\n";

  for (const alloc of status.allocations) {
    const currentPct = (alloc.currentAllocation * 100).toFixed(1);
    const targetPct = (alloc.targetAllocation * 100).toFixed(0);
    const devPct = (alloc.deviation * 100).toFixed(1);
    const devSign = alloc.deviation >= 0 ? "+" : "";

    text += `${alloc.symbol}\n`;
    text += `  Balance: ${alloc.balance.toFixed(8)}\n`;
    text += `  Value: $${alloc.valueInUsdc.toFixed(2)}\n`;
    text += `  Alloc: ${currentPct}% / ${targetPct}% (${devSign}${devPct}%)\n\n`;
  }

  text += "─".repeat(25) + "\n";
  text += `Total: $${status.totalValueInUsdc.toFixed(2)}\n\n`;
  text += `Next buy: ${status.assetToBuy} (${(status.maxDeviation * 100).toFixed(1)}% below target)`;

  return { text };
}
