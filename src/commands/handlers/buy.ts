/**
 * Buy command handler (dev mode only)
 */

import {
  MessageContext,
  ServiceContext,
  MessageResponse,
} from "../../types/handlers.js";
import { MOCK_PRICES } from "../../services/dca.js";

export async function handleBuyCommand(
  args: string[],
  ctx: MessageContext,
  services: ServiceContext,
): Promise<MessageResponse> {
  if (!services.dca) {
    return {
      text: "Mock purchases are not available.",
    };
  }

  if (!services.dca.isMockMode()) {
    return {
      text: "Mock purchases only available in development mode.",
    };
  }

  const amountStr = args[0];
  if (!amountStr) {
    return {
      text:
        "Usage: /buy <amount_in_sol>\n\n" +
        "Example: /buy 0.5\n\n" +
        "This will mock-purchase the asset furthest below its target allocation.",
    };
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return {
      text: "Invalid amount. Please provide a positive number.\n\nExample: /buy 0.5",
    };
  }

  services.db.createUser(ctx.telegramId);

  // Check user has a wallet connected
  const user = services.db.getUser(ctx.telegramId);
  if (!user?.walletAddress) {
    return {
      text:
        "No wallet connected.\n\n" +
        "Use /wallet set <address> to connect your Solana wallet first.",
    };
  }

  // Check SOL balance (but don't deduct in mock mode)
  const balanceCheck = await services.dca.checkSolBalance(user.walletAddress, amount);
  if (!balanceCheck.sufficient) {
    return {
      text:
        `Insufficient SOL balance.\n\n` +
        `Required: ${amount} SOL\n` +
        `Available: ${balanceCheck.balance.toFixed(4)} SOL`,
    };
  }

  // Execute mock purchase
  const result = await services.dca.executeMockPurchase(ctx.telegramId, amount);

  if (!result.success) {
    return {
      text: `Purchase failed: ${result.message}`,
    };
  }

  const priceUsd = MOCK_PRICES[result.asset];
  const valueUsd = result.amount * priceUsd;

  return {
    text:
      `Mock Purchase Complete\n` +
      `─`.repeat(25) + `\n\n` +
      `Asset: ${result.asset}\n` +
      `Amount: ${result.amount.toFixed(8)} ${result.asset}\n` +
      `Cost: ${amount} SOL\n` +
      `Value: $${valueUsd.toFixed(2)}\n` +
      `Price: $${priceUsd.toLocaleString()}\n\n` +
      `Note: This is a mock purchase. No real tokens were swapped.\n` +
      `Your SOL balance was checked but not deducted.\n\n` +
      `Use /status to see your portfolio.`,
  };
}
