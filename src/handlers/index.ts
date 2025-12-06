/**
 * Message handler abstraction - processes messages independent of transport (Telegram/Web)
 */

import { DatabaseService } from "../db/index.js";
import { SolanaService } from "../services/solana.js";

export interface ServiceContext {
  db: DatabaseService;
  solana: SolanaService;
}

export interface MessageContext {
  userId: string;
  telegramId: number;
  username?: string;
  text: string;
}

export interface InlineButton {
  text: string;
  callbackData: string;
}

export interface MessageResponse {
  text: string;
  inlineKeyboard?: InlineButton[][];
}

/**
 * Processes a user message and returns a response
 * This is the core logic that both Telegram bot and web interface use
 */
export async function handleMessage(
  ctx: MessageContext,
  services: ServiceContext,
): Promise<MessageResponse> {
  const text = ctx.text.trim();

  // Handle commands
  if (text.startsWith("/")) {
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    return handleCommand(command, args, ctx, services);
  }

  // Handle plain text
  return {
    text: "Unknown command. Use /help to see available commands.",
  };
}

async function handleCommand(
  command: string,
  args: string[],
  ctx: MessageContext,
  services: ServiceContext,
): Promise<MessageResponse> {
  switch (command) {
    case "/start":
      // Ensure user exists in database
      services.db.createUser(ctx.telegramId);
      return {
        text:
          "DCA Bot for Solana\n\n" +
          "Commands:\n" +
          "/wallet - Manage your wallet\n" +
          "/status - Portfolio status\n" +
          "/balance - Check balances\n" +
          "/help - Show help",
      };

    case "/help":
      return {
        text:
          "Healthy Crypto Index DCA Bot\n\n" +
          "Target allocations:\n" +
          "- BTC: 40%\n" +
          "- ETH: 30%\n" +
          "- SOL: 30%\n\n" +
          "Wallet commands:\n" +
          "/wallet - Show current wallet\n" +
          "/wallet set <address> - Connect existing wallet\n" +
          "/wallet remove - Disconnect wallet\n\n" +
          "The bot purchases the asset furthest below its target allocation.",
      };

    case "/wallet":
      return handleWalletCommand(args, ctx, services);

    case "/status":
      return {
        text: "Portfolio status: Not implemented yet",
      };

    case "/balance":
      return handleBalanceCommand(ctx, services);

    default:
      return {
        text: `Unknown command: ${command}\nUse /help to see available commands.`,
      };
  }
}

async function handleWalletCommand(
  args: string[],
  ctx: MessageContext,
  services: ServiceContext,
): Promise<MessageResponse> {
  const subcommand = args[0]?.toLowerCase();

  // Ensure user exists
  services.db.createUser(ctx.telegramId);

  if (!subcommand) {
    // Show current wallet
    const user = services.db.getUser(ctx.telegramId);
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
    const user = services.db.getUser(ctx.telegramId);
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
    const user = services.db.getUser(ctx.telegramId);
    if (!user?.walletAddress) {
      return {
        text: "No wallet is currently connected.",
      };
    }

    services.db.setWalletAddress(ctx.telegramId, "");
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

async function handleBalanceCommand(
  ctx: MessageContext,
  services: ServiceContext,
): Promise<MessageResponse> {
  services.db.createUser(ctx.telegramId);
  const user = services.db.getUser(ctx.telegramId);

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

async function saveWallet(
  telegramId: number,
  walletAddress: string,
  services: ServiceContext,
): Promise<MessageResponse> {
  services.db.setWalletAddress(telegramId, walletAddress);

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

/**
 * Handle callback queries from inline keyboards
 */
export async function handleCallback(
  telegramId: number,
  callbackData: string,
  services: ServiceContext,
): Promise<MessageResponse> {
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

  return {
    text: "Unknown action.",
  };
}
