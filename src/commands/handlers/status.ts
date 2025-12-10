/**
 * Status command handler (dev mode only)
 */

import {
  MessageContext,
  ServiceContext,
  MessageResponse,
} from "../../types/handlers.js";
import { TARGET_ALLOCATIONS } from "../../types/portfolio.js";
import { MOCK_PRICES } from "../../services/dca.js";

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

  services.userRepository.create(ctx.telegramId);
  services.dca.createPortfolio(ctx.telegramId);

  const status = services.dca.getPortfolioStatus(ctx.telegramId);
  if (!status) {
    return {
      text: "Portfolio not found. Use /buy <amount> to make your first purchase.",
    };
  }

  if (status.totalValueInSol === 0) {
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
    const valueUsd = alloc.balance * MOCK_PRICES[alloc.symbol];

    text += `${alloc.symbol}\n`;
    text += `  Balance: ${alloc.balance.toFixed(8)}\n`;
    text += `  Value: $${valueUsd.toFixed(2)} (${alloc.valueInSol.toFixed(4)} SOL)\n`;
    text += `  Alloc: ${currentPct}% / ${targetPct}% (${devSign}${devPct}%)\n\n`;
  }

  const totalUsd = status.totalValueInSol * MOCK_PRICES.SOL;
  text += "─".repeat(25) + "\n";
  text += `Total: $${totalUsd.toFixed(2)} (${status.totalValueInSol.toFixed(4)} SOL)\n\n`;
  text += `Next buy: ${status.assetToBuy} (${(status.maxDeviation * 100).toFixed(1)}% below target)`;

  return { text };
}
