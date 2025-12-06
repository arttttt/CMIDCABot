/**
 * Message handler abstraction - processes messages independent of transport (Telegram/Web)
 */

export interface MessageContext {
  userId: string;
  username?: string;
  text: string;
}

export interface MessageResponse {
  text: string;
}

/**
 * Processes a user message and returns a response
 * This is the core logic that both Telegram bot and web interface use
 */
export function handleMessage(ctx: MessageContext): MessageResponse {
  const text = ctx.text.trim();

  // Handle commands
  if (text.startsWith("/")) {
    const command = text.split(" ")[0].toLowerCase();
    return handleCommand(command);
  }

  // Handle plain text
  return {
    text: 'Unknown command. Use /help to see available commands.',
  };
}

function handleCommand(command: string): MessageResponse {
  switch (command) {
    case "/start":
      return {
        text:
          "DCA Bot for Solana\n\n" +
          "Commands:\n" +
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
          "The bot purchases the asset furthest below its target allocation.",
      };

    case "/status":
      return {
        text: "Portfolio status: Not implemented yet",
      };

    case "/balance":
      return {
        text: "Balance check: Not implemented yet",
      };

    default:
      return {
        text: `Unknown command: ${command}\nUse /help to see available commands.`,
      };
  }
}
