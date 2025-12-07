/**
 * Message handler abstraction - processes messages independent of transport (Telegram/Web)
 */

import { DatabaseService } from "../db/index.js";
import { SolanaService } from "../services/solana.js";
import { DcaService, MOCK_PRICES } from "../services/dca.js";
import { TARGET_ALLOCATIONS } from "../types/portfolio.js";

export interface ServiceContext {
  db: DatabaseService;
  solana: SolanaService;
  dca?: DcaService;
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
      services.db.createPortfolio(ctx.telegramId);
      return {
        text:
          "DCA Bot for Solana\n\n" +
          "Commands:\n" +
          "/wallet - Manage your wallet\n" +
          "/status - Portfolio status\n" +
          "/buy <amount> - Mock purchase\n" +
          "/balance - Check SOL balance\n" +
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
          "Commands:\n" +
          "/wallet - Show current wallet\n" +
          "/wallet set <address> - Connect wallet\n" +
          "/wallet remove - Disconnect wallet\n" +
          "/status - View portfolio & allocations\n" +
          "/buy <amount> - Mock purchase (dev mode)\n" +
          "/balance - Check SOL balance\n\n" +
          "The bot purchases the asset furthest below its target allocation.\n\n" +
          "Note: In development mode, purchases are simulated without real swaps.",
      };

    case "/wallet":
      return handleWalletCommand(args, ctx, services);

    case "/status":
      return handleStatusCommand(ctx, services);

    case "/buy":
      return handleBuyCommand(args, ctx, services);

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

async function handleStatusCommand(
  ctx: MessageContext,
  services: ServiceContext,
): Promise<MessageResponse> {
  if (!services.dca || !services.dca.isMockMode()) {
    return {
      text: "Portfolio tracking is only available in development mode.",
    };
  }

  services.db.createUser(ctx.telegramId);
  services.db.createPortfolio(ctx.telegramId);

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

async function handleBuyCommand(
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
