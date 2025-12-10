/**
 * Balance command handler
 */

import {
  MessageContext,
  ServiceContext,
  MessageResponse,
} from "../../types/handlers.js";

export async function handleBalanceCommand(
  _args: string[],
  ctx: MessageContext,
  services: ServiceContext,
): Promise<MessageResponse> {
  await services.userRepository.create(ctx.telegramId);
  const user = await services.userRepository.getById(ctx.telegramId);

  if (!user?.walletAddress) {
    return {
      text:
        "No wallet connected.\n\n" +
        "Use /wallet set <address> to connect your Solana wallet first.",
    };
  }

  try {
    const balance = await services.solana.getBalance(user.walletAddress);
    return {
      text:
        `Wallet: ${user.walletAddress.slice(0, 8)}...${user.walletAddress.slice(-8)}\n\n` +
        `SOL Balance: ${balance.toFixed(4)} SOL`,
    };
  } catch {
    return {
      text: "Failed to fetch balance. Please try again later.",
    };
  }
}
