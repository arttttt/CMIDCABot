/**
 * Wallet command handler
 */

import {
  MessageContext,
  ServiceContext,
  MessageResponse,
} from "../../types/handlers.js";

async function saveWallet(
  telegramId: number,
  walletAddress: string,
  services: ServiceContext,
): Promise<MessageResponse> {
  services.userRepository.setWalletAddress(telegramId, walletAddress);

  try {
    const balance = await services.solana.getBalance(walletAddress);
    return {
      text:
        `Wallet connected successfully!\n\n` +
        `Address: ${walletAddress}\n` +
        `Balance: ${balance.toFixed(4)} SOL`,
    };
  } catch {
    return {
      text:
        `Wallet connected successfully!\n\n` +
        `Address: ${walletAddress}\n` +
        `Balance: Unable to fetch (wallet may be new or network issue)`,
    };
  }
}

export async function handleWalletCommand(
  args: string[],
  ctx: MessageContext,
  services: ServiceContext,
): Promise<MessageResponse> {
  const subcommand = args[0]?.toLowerCase();

  // Ensure user exists
  services.userRepository.create(ctx.telegramId);

  if (!subcommand) {
    // Show current wallet
    const user = services.userRepository.getById(ctx.telegramId);
    if (!user?.walletAddress) {
      return {
        text:
          "No wallet connected.\n\n" +
          "Use /wallet set <address> to connect your Solana wallet.",
      };
    }

    try {
      const balance = await services.solana.getBalance(user.walletAddress);
      return {
        text:
          `Connected wallet:\n${user.walletAddress}\n\n` +
          `Balance: ${balance.toFixed(4)} SOL`,
      };
    } catch {
      return {
        text:
          `Connected wallet:\n${user.walletAddress}\n\n` +
          `Balance: Unable to fetch`,
      };
    }
  }

  if (subcommand === "set") {
    const walletAddress = args[1];

    if (!walletAddress) {
      return {
        text:
          "Please provide a wallet address.\n\n" +
          "Usage: /wallet set <solana-address>\n" +
          "Example: /wallet set 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      };
    }

    // Validate address
    if (!services.solana.isValidAddress(walletAddress)) {
      return {
        text:
          "Invalid Solana address.\n\n" +
          "Please provide a valid Solana wallet address (base58 encoded, 32-44 characters).",
      };
    }

    // Check if user already has a wallet
    const user = services.userRepository.getById(ctx.telegramId);
    if (user?.walletAddress) {
      // Same wallet - just inform
      if (user.walletAddress === walletAddress) {
        try {
          const balance = await services.solana.getBalance(walletAddress);
          return {
            text:
              `This wallet is already connected.\n\n` +
              `Address: ${walletAddress}\n` +
              `Balance: ${balance.toFixed(4)} SOL`,
          };
        } catch {
          return {
            text:
              `This wallet is already connected.\n\n` +
              `Address: ${walletAddress}`,
          };
        }
      }

      // Different wallet - ask for confirmation
      return {
        text:
          `You already have a wallet connected:\n` +
          `${user.walletAddress}\n\n` +
          `Do you want to replace it with:\n` +
          `${walletAddress}?`,
        inlineKeyboard: [
          [
            { text: "Yes, replace", callbackData: `wallet_replace:${walletAddress}` },
            { text: "Cancel", callbackData: "wallet_cancel" },
          ],
        ],
      };
    }

    // No existing wallet - save directly
    return saveWallet(ctx.telegramId, walletAddress, services);
  }

  if (subcommand === "remove") {
    const user = services.userRepository.getById(ctx.telegramId);
    if (!user?.walletAddress) {
      return {
        text: "No wallet is currently connected.",
      };
    }

    services.userRepository.setWalletAddress(ctx.telegramId, "");
    return {
      text: "Wallet disconnected successfully.",
    };
  }

  return {
    text:
      "Unknown wallet command.\n\n" +
      "Available commands:\n" +
      "/wallet - Show current wallet\n" +
      "/wallet set <address> - Connect wallet\n" +
      "/wallet remove - Disconnect wallet",
  };
}

/**
 * Handle wallet-related callback queries
 */
export async function handleWalletCallback(
  telegramId: number,
  callbackData: string,
  services: ServiceContext,
): Promise<MessageResponse | null> {
  if (callbackData === "wallet_cancel") {
    return {
      text: "Wallet replacement cancelled.",
    };
  }

  if (callbackData.startsWith("wallet_replace:")) {
    const walletAddress = callbackData.replace("wallet_replace:", "");

    // Validate address again for security
    if (!services.solana.isValidAddress(walletAddress)) {
      return {
        text: "Invalid wallet address. Please try again.",
      };
    }

    return saveWallet(telegramId, walletAddress, services);
  }

  return null;
}
